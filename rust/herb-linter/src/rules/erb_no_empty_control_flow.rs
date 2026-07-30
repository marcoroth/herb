use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::*;
use herb::union_types::ERBElseNodeOrERBIfNode;
use herb::{Location, ParseResult, Visitor};
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoEmptyControlFlowRule;

struct ERBNoEmptyControlFlowVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  processed_if_nodes: HashSet<usize>,
  processed_else_nodes: HashSet<usize>,
}

/// An `if`/`elsif`/`else` link in a chain.
enum ChainLink<'node> {
  If(&'node ERBIfNode),
  Else(&'node ERBElseNode),
}

impl<'node> ChainLink<'node> {
  fn statements(&self) -> &'node [AnyNode] {
    match self {
      ChainLink::If(node) => &node.statements,
      ChainLink::Else(node) => &node.statements,
    }
  }

  fn location(&self) -> &'node Location {
    match self {
      ChainLink::If(node) => &node.location,
      ChainLink::Else(node) => &node.location,
    }
  }
}

fn chain_links(start: &Option<ERBElseNodeOrERBIfNode>) -> Vec<ChainLink<'_>> {
  let mut links = Vec::new();
  let mut current = start;

  loop {
    match current {
      Some(ERBElseNodeOrERBIfNode::ERBIfNode(node)) => {
        links.push(ChainLink::If(node));
        current = &node.subsequent;
      }

      Some(ERBElseNodeOrERBIfNode::ERBElseNode(node)) => {
        links.push(ChainLink::Else(node));
        break;
      }

      None => break,
    }
  }

  links
}

fn statements_have_content(statements: &[AnyNode]) -> bool {
  statements.iter().any(|statement| match statement {
    AnyNode::HTMLTextNode(text) => !text.content.trim().is_empty(),
    _ => true,
  })
}

impl ERBNoEmptyControlFlowVisitor {
  fn add_empty_block_offense(&mut self, location: &Location, statements: &[AnyNode], block_type: &str) {
    self.add_empty_block_offense_with_end(location, statements, block_type, None);
  }

  fn add_empty_block_offense_with_end(&mut self, location: &Location, statements: &[AnyNode], block_type: &str, subsequent_location: Option<&Location>) {
    if statements_have_content(statements) {
      return;
    }

    let end = subsequent_location.map(|location| &location.start).unwrap_or(&location.end);

    self.offenses.push(UnboundOffense::with_tags(
      self.rule_name,
      format!("Empty {} block: this control flow statement has no content", block_type),
      Location::from(location.start.line, location.start.column, end.line, end.column),
      vec!["unnecessary".to_string()],
    ));
  }

  fn mark_if_chain_as_processed(&mut self, node: &ERBIfNode) {
    self.processed_if_nodes.insert(node as *const ERBIfNode as usize);

    for link in chain_links(&node.subsequent) {
      match link {
        ChainLink::If(node) => {
          self.processed_if_nodes.insert(node as *const ERBIfNode as usize);
        }

        ChainLink::Else(node) => {
          self.processed_else_nodes.insert(node as *const ERBElseNode as usize);
        }
      }
    }
  }

  fn is_entire_if_chain_empty(&self, node: &ERBIfNode) -> bool {
    if statements_have_content(&node.statements) {
      return false;
    }

    !chain_links(&node.subsequent).iter().any(|link| statements_have_content(link.statements()))
  }

  fn check_if_chain_parts(&mut self, node: &ERBIfNode) {
    if !statements_have_content(&node.statements) {
      let subsequent_location = chain_links(&node.subsequent).first().map(|link| link.location().clone());

      self.add_empty_block_offense_with_end(&node.location.clone(), &node.statements, "if", subsequent_location.as_ref());
    }

    let links = chain_links(&node.subsequent);

    for (index, link) in links.iter().enumerate() {
      if statements_have_content(link.statements()) {
        continue;
      }

      let block_type = match link {
        ChainLink::If(_) => "elsif",
        ChainLink::Else(_) => "else",
      };

      let next_location = match link {
        ChainLink::If(_) => links.get(index + 1).map(|next| next.location().clone()),
        ChainLink::Else(_) => None,
      };

      let location = link.location().clone();
      let statements = link.statements().to_vec();

      self.add_empty_block_offense_with_end(&location, &statements, block_type, next_location.as_ref());
    }
  }
}

impl Visitor for ERBNoEmptyControlFlowVisitor {
  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    if self.processed_if_nodes.contains(&(node as *const ERBIfNode as usize)) {
      return;
    }

    self.mark_if_chain_as_processed(node);

    if self.is_entire_if_chain_empty(node) {
      self.add_empty_block_offense(&node.location.clone(), &node.statements, "if");
    } else {
      self.check_if_chain_parts(node);
    }

    self.walk_erb_if_node(node);
  }

  fn visit_erb_else_node(&mut self, node: &ERBElseNode) {
    if !self.processed_else_nodes.contains(&(node as *const ERBElseNode as usize)) {
      self.add_empty_block_offense(&node.location.clone(), &node.statements, "else");
    }

    self.walk_erb_else_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    let unless_has_content = statements_have_content(&node.statements);

    let else_has_content = node
      .else_clause
      .as_ref()
      .map(|clause| statements_have_content(&clause.statements))
      .unwrap_or(false);

    if let Some(ref clause) = node.else_clause {
      self.processed_else_nodes.insert(clause.as_ref() as *const ERBElseNode as usize);
    }

    if !unless_has_content && !else_has_content {
      self.add_empty_block_offense(&node.location.clone(), &node.statements, "unless");
    } else {
      if !unless_has_content {
        let else_location = node.else_clause.as_ref().map(|clause| clause.location.clone());

        self.add_empty_block_offense_with_end(&node.location.clone(), &node.statements, "unless", else_location.as_ref());
      }

      if let Some(ref clause) = node.else_clause {
        if !else_has_content {
          self.add_empty_block_offense(&clause.location.clone(), &clause.statements, "else");
        }
      }
    }

    self.walk_erb_unless_node(node);
  }

  fn visit_erb_for_node(&mut self, node: &ERBForNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "for");
    self.walk_erb_for_node(node);
  }

  fn visit_erb_while_node(&mut self, node: &ERBWhileNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "while");
    self.walk_erb_while_node(node);
  }

  fn visit_erb_until_node(&mut self, node: &ERBUntilNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "until");
    self.walk_erb_until_node(node);
  }

  fn visit_erb_when_node(&mut self, node: &ERBWhenNode) {
    if node.then_keyword.is_none() {
      self.add_empty_block_offense(&node.location.clone(), &node.statements, "when");
    }

    self.walk_erb_when_node(node);
  }

  fn visit_erb_in_node(&mut self, node: &ERBInNode) {
    if node.then_keyword.is_none() {
      self.add_empty_block_offense(&node.location.clone(), &node.statements, "in");
    }

    self.walk_erb_in_node(node);
  }

  fn visit_erb_begin_node(&mut self, node: &ERBBeginNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "begin");
    self.walk_erb_begin_node(node);
  }

  fn visit_erb_rescue_node(&mut self, node: &ERBRescueNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "rescue");
    self.walk_erb_rescue_node(node);
  }

  fn visit_erb_ensure_node(&mut self, node: &ERBEnsureNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.statements, "ensure");
    self.walk_erb_ensure_node(node);
  }

  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.add_empty_block_offense(&node.location.clone(), &node.body, "do");
    self.walk_erb_block_node(node);
  }
}

impl Rule for ERBNoEmptyControlFlowRule {
  fn name(&self) -> &'static str {
    "erb-no-empty-control-flow"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Hint)
  }
}

impl ParserRule for ERBNoEmptyControlFlowRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = ERBNoEmptyControlFlowVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      processed_if_nodes: HashSet::new(),
      processed_else_nodes: HashSet::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
