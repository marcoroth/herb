use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::walk_prism;
use crate::utils::tag_utils::{element_tag_name_location, get_tag_local_name, is_erb_output_node};

use herb::nodes::{ERBBlockNode, ERBContentNode, HTMLElementNode};
use herb::prism::PrismNode;
use herb::Location;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct HTMLNoNestedFormsRule;

impl Rule for HTMLNoNestedFormsRule {
  fn name(&self) -> &'static str {
    "html-no-nested-forms"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

fn form_helper_names() -> HashSet<&'static str> {
  let mut names = HashSet::new();

  for entry in herb::action_view_helpers::helpers_for_tag("form") {
    if entry.supported {
      continue;
    }

    names.insert(entry.name);
    names.extend(entry.aliases.iter().copied());
  }

  names
}

struct NestedFormVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  form_depth: usize,
  form_helpers: HashSet<&'static str>,
}

impl NestedFormVisitor {
  fn add_offense(&mut self, message: impl Into<String>, location: Location) {
    self.offenses.push(UnboundOffense::new(self.rule_name, message, location));
  }

  fn form_helper_name(&self, prism_node: Option<&PrismNode>) -> Option<&'static str> {
    let prism_node = prism_node?;
    let mut found = None;

    walk_prism(prism_node, &mut |node| {
      if found.is_some() {
        return false;
      }

      if node.is("CallNode") && node.receiver().is_none() {
        if let Some(name) = node.name.as_deref() {
          if let Some(helper) = self.form_helpers.get(name) {
            found = Some(*helper);
            return false;
          }
        }
      }

      true
    });

    found
  }

  fn check_nested_helper(&mut self, helper_name: &str, location: Location) {
    if self.form_depth == 0 {
      return;
    }

    self.add_offense(
      format!("`{helper_name}` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`."),
      location,
    );
  }
}

impl Visitor for NestedFormVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() != Some("form") {
      self.walk_html_element_node(node);
      return;
    }

    if self.form_depth > 0 {
      let location = element_tag_name_location(node);

      self.add_offense(
        "Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.",
        location,
      );
    }

    self.form_depth += 1;
    self.walk_html_element_node(node);
    self.form_depth -= 1;
  }

  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    let helper_name = if is_erb_output_node_block(node) {
      self.form_helper_name(node.prism())
    } else {
      None
    };

    let helper_name = match helper_name {
      Some(name) => name,
      None => {
        self.walk_erb_block_node(node);
        return;
      }
    };

    self.check_nested_helper(helper_name, node.location.clone());

    self.form_depth += 1;
    self.walk_erb_block_node(node);
    self.form_depth -= 1;
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if is_erb_output_node(node) {
      if let Some(helper_name) = self.form_helper_name(node.prism()) {
        self.check_nested_helper(helper_name, node.location.clone());
      }
    }

    self.walk_erb_content_node(node);
  }
}

fn is_erb_output_node_block(node: &ERBBlockNode) -> bool {
  node
    .tag_opening
    .as_ref()
    .map(|token| token.value == "<%=" || token.value == "<%==")
    .unwrap_or(false)
}

impl ParserRule for HTMLNoNestedFormsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NestedFormVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      form_depth: 0,
      form_helpers: form_helper_names(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
