use crate::offense::Offense;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;
use herb::nodes::AnyNode;
use herb::nodes::DocumentNode;

use herb::nodes::ERBStrictLocalsNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewStrictLocalsPartialOnlyRule;

rule_visitor!(ActionViewStrictLocalsPartialOnlyVisitor);

impl Visitor for ActionViewStrictLocalsPartialOnlyVisitor {
  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    self.add_offense(
      "Strict locals declarations are only supported in partials. This file is not a partial.",
      node.location.clone(),
    );
  }
}

impl Rule for ActionViewStrictLocalsPartialOnlyRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn unsafe_autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "actionview-strict-locals-partial-only"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.3")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Warning)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      strict_locals: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ActionViewStrictLocalsPartialOnlyRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let index = document
      .children
      .iter()
      .position(|child| child.location().start.line == offense.location.start.line && child.location().start.column == offense.location.start.column);

    let index = match index {
      Some(index) => index,
      None => return false,
    };

    document.children.remove(index);

    let removes_following_blank_line = matches!(
      document.children.get(index),
      Some(AnyNode::HTMLTextNode(text)) if text.content.trim_start_matches([' ', '\t']).starts_with('\n')
    );

    if removes_following_blank_line {
      document.children.remove(index);
    }

    true
  }

  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let is_not_partial = context.file_name.as_deref().map(|file_name| !is_partial_file(file_name)).unwrap_or(false);

    if !is_not_partial {
      return Vec::new();
    }

    let mut visitor = ActionViewStrictLocalsPartialOnlyVisitor::new(<Self as Rule>::name(self));

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
