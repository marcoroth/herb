use crate::autofix::location_matches;
use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::{AnyNode, DocumentNode, ERBIfNode, ERBUnlessNode};
use herb::Location;
use herb::ParseResult;
use herb::Token;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};
use herb_printer::IdentityPrinter;

pub struct ERBPreferExplicitConditionalsRule;

impl Rule for ERBPreferExplicitConditionalsRule {
  fn name(&self) -> &'static str {
    "erb-prefer-explicit-conditionals"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_enabled(&self) -> bool {
    false
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      transform_conditionals: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

// a transformed inline conditional carries a zero-width synthesized opening tag
fn is_synthesized(tag_opening: &Option<Token>) -> bool {
  match tag_opening {
    Some(token) => token.location.start.line == token.location.end.line && token.location.start.column == token.location.end.column,
    None => false,
  }
}

fn collapse_whitespace(value: &str) -> String {
  let mut result = String::with_capacity(value.len());
  let mut chars = value.chars().peekable();

  while let Some(character) = chars.next() {
    if character == '\n' || ((character == ' ' || character == '\t') && chars.peek().is_some_and(|next| *next == '\n' || *next == ' ' || *next == '\t')) {
      while chars.peek().is_some_and(|next| next.is_whitespace()) {
        chars.next();
      }

      result.push(' ');
      continue;
    }

    result.push(character);
  }

  result
}

fn suggestion_for(node: AnyNode) -> String {
  collapse_whitespace(&IdentityPrinter::print_nodes(&[node]))
}

rule_visitor!(PreferExplicitConditionalsVisitor);

impl PreferExplicitConditionalsVisitor {
  fn report(&mut self, keyword: &str, suggestion: String, location: Location) {
    self.add_offense(
      format!("Prefer an explicit `<% {keyword} %>` block over an inline `{keyword}` condition. Use `{suggestion}` instead."),
      location,
    );
  }
}

impl Visitor for PreferExplicitConditionalsVisitor {
  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    if is_synthesized(&node.tag_opening) && node.subsequent.is_none() {
      let suggestion = suggestion_for(AnyNode::ERBIfNode(Box::new(node.clone())));
      self.report("if", suggestion, node.location.clone());
    }

    self.walk_erb_if_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    if is_synthesized(&node.tag_opening) {
      let suggestion = suggestion_for(AnyNode::ERBUnlessNode(Box::new(node.clone())));
      self.report("unless", suggestion, node.location.clone());
    }

    self.walk_erb_unless_node(node);
  }
}

impl ParserRule for ERBPreferExplicitConditionalsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = PreferExplicitConditionalsVisitor::new(self.name());

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }

  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let mut fixed = false;

    crate::autofix::for_each_node_array_mut(document, &mut |nodes| {
      if fixed {
        return;
      }

      // the transformed conditional already holds the body, so replacing the
      // single-statement body node with it restores the explicit block
      for index in 0..nodes.len() {
        let replacement = match &nodes[index] {
          AnyNode::ERBContentNode(content) if location_matches(&content.location, offense) => None,
          AnyNode::ERBIfNode(node) if location_matches(&node.location, offense) && is_synthesized(&node.tag_opening) => {
            single_content_body(&node.statements).map(|_| AnyNode::ERBIfNode(node.clone()))
          }
          AnyNode::ERBUnlessNode(node) if location_matches(&node.location, offense) && is_synthesized(&node.tag_opening) => {
            single_content_body(&node.statements).map(|_| AnyNode::ERBUnlessNode(node.clone()))
          }
          _ => None,
        };

        if let Some(replacement) = replacement {
          nodes[index] = replacement;
          fixed = true;
          return;
        }
      }
    });

    fixed
  }
}

fn single_content_body(statements: &[AnyNode]) -> Option<&AnyNode> {
  if statements.len() != 1 {
    return None;
  }

  match &statements[0] {
    node @ AnyNode::ERBContentNode(content) if content.tag_closing.as_ref().map(|token| token.value.as_str()) == Some("%>") => Some(node),
    _ => None,
  }
}
