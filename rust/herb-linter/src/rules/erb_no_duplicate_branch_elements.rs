use crate::autofix::{for_each_node_array_mut, literal_node, trim_whitespace_nodes, wrapper_element};
use crate::offense::Offense;
use herb::nodes::DocumentNode;
use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::source_slice::identity_print;
use crate::utils::tag_utils::{get_open_tag, is_equivalent_element};

use herb::nodes::*;
use herb::union_types::ERBElseNodeOrERBIfNode;
use herb::{Location, ParseResult, Visitor};
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoDuplicateBranchElementsRule;

struct ERBNoDuplicateBranchElementsVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
  processed_if_nodes: HashSet<usize>,
}

fn is_pure_whitespace_node(node: &AnyNode) -> bool {
  match node {
    AnyNode::LiteralNode(literal) => literal.content.trim().is_empty(),
    AnyNode::HTMLTextNode(text) => text.content.trim().is_empty(),
    AnyNode::WhitespaceNode(_) => true,
    _ => false,
  }
}

fn significant_nodes(statements: &[AnyNode]) -> Vec<&AnyNode> {
  statements.iter().filter(|node| !is_pure_whitespace_node(node)).collect()
}

fn as_element(node: &AnyNode) -> Option<&HTMLElementNode> {
  match node {
    AnyNode::HTMLElementNode(element) => Some(element),
    _ => None,
  }
}

/// Whether every node is an element structurally equivalent to the first.
fn all_equivalent_elements(nodes: &[Option<&AnyNode>]) -> bool {
  if nodes.len() < 2 {
    return false;
  }

  let elements: Vec<&HTMLElementNode> = match nodes.iter().map(|node| node.and_then(|node| as_element(node))).collect() {
    Some(elements) => elements,
    None => return false,
  };

  elements[1..].iter().all(|element| is_equivalent_element(elements[0], element))
}

fn collect_branches_from_if(node: &ERBIfNode) -> Option<Vec<&[AnyNode]>> {
  let mut branches: Vec<&[AnyNode]> = vec![&node.statements];
  let mut current = &node.subsequent;

  loop {
    match current {
      Some(ERBElseNodeOrERBIfNode::ERBElseNode(else_node)) => {
        branches.push(&else_node.statements);
        return Some(branches);
      }

      Some(ERBElseNodeOrERBIfNode::ERBIfNode(if_node)) => {
        branches.push(&if_node.statements);
        current = &if_node.subsequent;
      }

      None => return None,
    }
  }
}

fn collect_branches_from_unless(node: &ERBUnlessNode) -> Option<Vec<&[AnyNode]>> {
  let else_clause = node.else_clause.as_ref()?;

  Some(vec![&node.statements, &else_clause.statements])
}

fn collect_branches_from_case(node: &ERBCaseNode) -> Option<Vec<&[AnyNode]>> {
  let else_clause = node.else_clause.as_ref()?;
  let mut branches: Vec<&[AnyNode]> = Vec::new();

  for condition in &node.conditions {
    if let AnyNode::ERBWhenNode(when) = condition {
      branches.push(&when.statements);
    }
  }

  branches.push(&else_clause.statements);

  Some(branches)
}

impl<'rule> ERBNoDuplicateBranchElementsVisitor<'rule> {
  fn print(&self, location: &Location) -> String {
    identity_print(self.source, location)
  }

  fn all_branches_identical(&self, branches: &[&[AnyNode]]) -> bool {
    if branches.len() < 2 {
      return false;
    }

    let first: String = branches[0].iter().map(|node| self.print(node.location())).collect();

    branches[1..]
      .iter()
      .all(|branch| branch.iter().map(|node| self.print(node.location())).collect::<String>() == first)
  }

  fn mark_subsequent_if_nodes_as_processed(&mut self, node: &ERBIfNode) {
    let mut current = &node.subsequent;

    while let Some(ERBElseNodeOrERBIfNode::ERBIfNode(if_node)) = current {
      self.processed_if_nodes.insert(if_node.as_ref() as *const ERBIfNode as usize);
      current = &if_node.subsequent;
    }
  }

  fn check_conditional_node(&mut self, branches: Option<Vec<&[AnyNode]>>, location: &Location) {
    let branches = match branches {
      Some(branches) => branches,
      None => return,
    };

    if self.all_branches_identical(&branches) {
      self.offenses.push(UnboundOffense::with_severity(
        self.rule_name,
        "All branches of this conditional have identical content. The conditional can be removed.",
        location.clone(),
        Severity::Warning,
      ));

      return;
    }

    let mut is_first_offense = true;

    self.check_branches(&branches, &mut is_first_offense);
  }

  fn check_branches(&mut self, branches: &[&[AnyNode]], is_first_offense: &mut bool) {
    let significant: Vec<Vec<&AnyNode>> = branches.iter().map(|branch| significant_nodes(branch)).collect();

    if significant.iter().any(|branch| branch.is_empty()) {
      return;
    }

    let min_length = significant.iter().map(|branch| branch.len()).min().unwrap_or(0);

    let mut prefix_count = 0;

    for index in 0..min_length {
      let nodes: Vec<Option<&AnyNode>> = significant.iter().map(|branch| branch.get(index).copied()).collect();

      if all_equivalent_elements(&nodes) {
        prefix_count += 1;
      } else {
        break;
      }
    }

    let mut suffix_count = 0;

    for offset in 0..(min_length - prefix_count) {
      let nodes: Vec<Option<&AnyNode>> = significant.iter().map(|branch| branch.get(branch.len() - 1 - offset).copied()).collect();

      if all_equivalent_elements(&nodes) {
        suffix_count += 1;
      } else {
        break;
      }
    }

    for index in 0..prefix_count {
      let elements: Vec<&HTMLElementNode> = significant.iter().filter_map(|branch| as_element(branch[index])).collect();

      self.report_and_recurse(&elements, is_first_offense);
    }

    for offset in 0..suffix_count {
      let elements: Vec<&HTMLElementNode> = significant.iter().filter_map(|branch| as_element(branch[branch.len() - 1 - offset])).collect();

      self.report_and_recurse(&elements, is_first_offense);
    }
  }

  fn report_and_recurse(&mut self, elements: &[&HTMLElementNode], is_first_offense: &mut bool) {
    if elements.is_empty() {
      return;
    }

    let first_printed = self.print(&elements[0].location);
    let bodies_match = elements.iter().all(|element| self.print(&element.location) == first_printed);

    for element in elements {
      let open_tag_location = match &element.open_tag {
        Some(open_tag) => open_tag.location().clone(),
        None => element.location.clone(),
      };

      let printed = self.print(&open_tag_location);

      if bodies_match {
        let offense = UnboundOffense::new(
          self.rule_name,
          format!(
            "The `{}` element is duplicated across all branches of this conditional and can be moved outside.",
            printed
          ),
          element.location.clone(),
        );

        self.offenses.push(if *is_first_offense { offense } else { offense.not_autofixable() });
      } else {
        let tag_name_location = get_open_tag(element)
          .and_then(|open_tag| open_tag.tag_name.as_ref())
          .map(|token| token.location.clone())
          .unwrap_or(open_tag_location);

        let offense = UnboundOffense::with_severity(
          self.rule_name,
          format!(
            "The `{}` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.",
            printed
          ),
          tag_name_location,
          Severity::Hint,
        );

        self.offenses.push(if *is_first_offense { offense } else { offense.not_autofixable() });
      }

      *is_first_offense = false;
    }

    if !bodies_match && elements.iter().all(|element| !element.body.is_empty()) {
      let bodies: Vec<&[AnyNode]> = elements.iter().map(|element| element.body.as_slice()).collect();

      self.check_branches(&bodies, is_first_offense);
    }
  }
}

impl<'rule> Visitor for ERBNoDuplicateBranchElementsVisitor<'rule> {
  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    if self.processed_if_nodes.contains(&(node as *const ERBIfNode as usize)) {
      self.walk_erb_if_node(node);
      return;
    }

    let branches = collect_branches_from_if(node);

    if branches.is_some() {
      self.mark_subsequent_if_nodes_as_processed(node);
    }

    self.check_conditional_node(branches, &node.location.clone());
    self.walk_erb_if_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    self.check_conditional_node(collect_branches_from_unless(node), &node.location.clone());
    self.walk_erb_unless_node(node);
  }

  fn visit_erb_case_node(&mut self, node: &ERBCaseNode) {
    self.check_conditional_node(collect_branches_from_case(node), &node.location.clone());
    self.walk_erb_case_node(node);
  }
}

impl Rule for ERBNoDuplicateBranchElementsRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn reindent_after_autofix(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "erb-no-duplicate-branch-elements"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Warning)
  }
}

impl ParserRule for ERBNoDuplicateBranchElementsRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, context: &LintContext) -> bool {
    let source = context.source.clone();
    let mut fixed = false;

    for_each_node_array_mut(document, &mut |array| {
      if fixed {
        return;
      }

      let index = match array.iter().position(|node| conditional_covers(node, offense)) {
        Some(index) => index,
        None => return,
      };

      let mut conditional = array.remove(index);

      match hoist(&mut conditional, offense, &source) {
        Some(replacements) => {
          array.splice(index..index, replacements);
          fixed = true;
        }

        None => array.insert(index, conditional),
      }
    });

    fixed
  }

  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = ERBNoDuplicateBranchElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source: &context.source,
      processed_if_nodes: HashSet::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}

fn conditional_branches_mut(node: &mut AnyNode) -> Option<Vec<&mut Vec<AnyNode>>> {
  match node {
    AnyNode::ERBIfNode(node) => {
      let mut branches: Vec<&mut Vec<AnyNode>> = Vec::new();
      let mut current = Some(node.as_mut());

      while let Some(if_node) = current {
        branches.push(&mut if_node.statements);

        match if_node.subsequent.as_mut() {
          Some(ERBElseNodeOrERBIfNode::ERBIfNode(next)) => current = Some(next.as_mut()),
          Some(ERBElseNodeOrERBIfNode::ERBElseNode(else_node)) => {
            branches.push(&mut else_node.statements);
            return Some(branches);
          }
          None => return None,
        }
      }

      None
    }

    AnyNode::ERBUnlessNode(node) => {
      let ERBUnlessNode { statements, else_clause, .. } = node.as_mut();

      let else_clause = else_clause.as_mut()?;

      Some(vec![statements, &mut else_clause.statements])
    }

    AnyNode::ERBCaseNode(node) => {
      let ERBCaseNode { conditions, else_clause, .. } = node.as_mut();

      let else_clause = else_clause.as_mut()?;
      let mut branches: Vec<&mut Vec<AnyNode>> = Vec::new();

      for condition in conditions.iter_mut() {
        if let AnyNode::ERBWhenNode(when) = condition {
          branches.push(&mut when.statements);
        }
      }

      branches.push(&mut else_clause.statements);

      Some(branches)
    }

    _ => None,
  }
}

fn conditional_covers(node: &AnyNode, offense: &Offense) -> bool {
  if !matches!(node, AnyNode::ERBIfNode(_) | AnyNode::ERBUnlessNode(_) | AnyNode::ERBCaseNode(_)) {
    return false;
  }

  let location = node.location();
  let start = &offense.location.start;

  (location.start.line < start.line || (location.start.line == start.line && location.start.column <= start.column))
    && (location.end.line > start.line || (location.end.line == start.line && location.end.column >= start.column))
}

/// Hoists elements shared by every branch out of the conditional, returning the
/// nodes that replace it.
fn hoist(conditional: &mut AnyNode, offense: &Offense, source: &str) -> Option<Vec<AnyNode>> {
  let identical = {
    let branches = branch_slices(conditional)?;

    branches.len() >= 2 && branches[1..].iter().all(|branch| printed(branch, source) == printed(&branches[0], source))
  };

  if identical {
    let branches = branch_slices(conditional)?;

    return Some(trim_whitespace_nodes(&branches[0]));
  }

  let (prefix_count, suffix_count) = {
    let branches = branch_slices(conditional)?;
    let significant: Vec<Vec<AnyNode>> = branches.iter().map(|branch| significant_owned(branch)).collect();

    if significant.iter().any(|branch| branch.is_empty()) {
      return None;
    }

    common_counts(&significant)
  };

  if prefix_count == 0 && suffix_count == 0 {
    return None;
  }

  let _ = offense;

  // only the "wrap the whole conditional" shape is expressible without the
  // element-identity bookkeeping the JavaScript rule relies on
  let branches = branch_slices(conditional)?;
  let significant: Vec<Vec<AnyNode>> = branches.iter().map(|branch| significant_owned(branch)).collect();

  if !significant.iter().all(|branch| branch.len() == 1) {
    return None;
  }

  let elements: Vec<HTMLElementNode> = significant
    .iter()
    .filter_map(|branch| match &branch[0] {
      AnyNode::HTMLElementNode(element) => Some(element.as_ref().clone()),
      _ => None,
    })
    .collect();

  if elements.len() != significant.len() {
    return None;
  }

  let bodies_match = elements
    .iter()
    .all(|element| printed_element(element, source) == printed_element(&elements[0], source));

  if bodies_match || elements.iter().any(|element| element.body.is_empty()) {
    return None;
  }

  let mut branch_arrays = conditional_branches_mut(conditional)?;

  for branch in branch_arrays.iter_mut() {
    let replacement = branch
      .iter()
      .find_map(|node| match node {
        AnyNode::HTMLElementNode(element) => Some(element.body.clone()),
        _ => None,
      })
      .unwrap_or_default();

    let position = branch.iter().position(|node| matches!(node, AnyNode::HTMLElementNode(_)))?;

    branch.splice(position..position + 1, replacement);
  }

  let wrapper = wrapper_element(
    &elements[0],
    vec![
      AnyNode::LiteralNode(Box::new(literal_node("\n"))),
      conditional.clone(),
      AnyNode::LiteralNode(Box::new(literal_node("\n"))),
    ],
  );

  Some(vec![AnyNode::HTMLElementNode(Box::new(wrapper))])
}

fn branch_slices(node: &AnyNode) -> Option<Vec<Vec<AnyNode>>> {
  match node {
    AnyNode::ERBIfNode(node) => collect_branches_from_if(node).map(|b| b.into_iter().map(|s| s.to_vec()).collect()),
    AnyNode::ERBUnlessNode(node) => collect_branches_from_unless(node).map(|b| b.into_iter().map(|s| s.to_vec()).collect()),
    AnyNode::ERBCaseNode(node) => collect_branches_from_case(node).map(|b| b.into_iter().map(|s| s.to_vec()).collect()),
    _ => None,
  }
}

fn significant_owned(branch: &[AnyNode]) -> Vec<AnyNode> {
  branch.iter().filter(|node| !is_pure_whitespace_node(node)).cloned().collect()
}

fn printed(branch: &[AnyNode], source: &str) -> String {
  branch.iter().map(|node| identity_print(source, node.location())).collect()
}

fn printed_element(element: &HTMLElementNode, source: &str) -> String {
  identity_print(source, &element.location)
}

fn common_counts(significant: &[Vec<AnyNode>]) -> (usize, usize) {
  let min_length = significant.iter().map(|branch| branch.len()).min().unwrap_or(0);
  let mut prefix = 0;

  for index in 0..min_length {
    let nodes: Vec<Option<&AnyNode>> = significant.iter().map(|branch| branch.get(index)).collect();

    if all_equivalent_elements(&nodes) {
      prefix += 1;
    } else {
      break;
    }
  }

  let mut suffix = 0;

  for offset in 0..(min_length - prefix) {
    let nodes: Vec<Option<&AnyNode>> = significant.iter().map(|branch| branch.get(branch.len() - 1 - offset)).collect();

    if all_equivalent_elements(&nodes) {
      suffix += 1;
    } else {
      break;
    }
  }

  (prefix, suffix)
}
