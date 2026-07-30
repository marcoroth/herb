use crate::autofix::literal_node;
use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;

use herb::nodes::{AnyNode, DocumentNode, ERBStrictLocalsNode};
use herb::{Location, ParseResult, Position, Visitor};
use herb_config::{Severity, SeverityConfig};

pub struct ERBStrictLocalsRequiredRule;

#[derive(Default)]
struct StrictLocalsFinder {
  found: bool,
}

impl Visitor for StrictLocalsFinder {
  fn visit_erb_strict_locals_node(&mut self, _node: &ERBStrictLocalsNode) {
    self.found = true;
  }
}

impl Rule for ERBStrictLocalsRequiredRule {
  fn name(&self) -> &'static str {
    "erb-strict-locals-required"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn default_enabled(&self) -> bool {
    false
  }

  fn has_autofix(&self) -> bool {
    true
  }

  fn unsafe_autocorrectable(&self) -> bool {
    true
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      strict_locals: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBStrictLocalsRequiredRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    if !context.file_name.as_deref().map(is_partial_file).unwrap_or(false) {
      return Vec::new();
    }

    let mut finder = StrictLocalsFinder::default();

    finder.visit_document_node(&result.value);

    if finder.found {
      return Vec::new();
    }

    let end = result
      .value
      .children
      .first()
      .map(|child| child.location().end.clone())
      .unwrap_or_else(|| Position::new(0, 0));

    vec![UnboundOffense::new(
      self.name(),
      "Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.",
      Location::new(Position::new(1, 0), end),
    )]
  }

  fn autofix(&self, _offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    document
      .children
      .insert(0, AnyNode::LiteralNode(Box::new(literal_node("<%# locals: () %>\n\n"))));

    true
  }
}
