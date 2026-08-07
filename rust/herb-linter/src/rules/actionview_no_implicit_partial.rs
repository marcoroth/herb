use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_render;
use crate::utils::prism_utils::{constructs_object, is_static_partial_path, render_partial_expression};
use crate::utils::source_slice::location_from_offset;

use herb::nodes::ERBRenderNode;
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewNoImplicitPartialRule;

impl Rule for ActionViewNoImplicitPartialRule {
  fn name(&self) -> &'static str {
    "actionview-no-implicit-partial"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Info)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      render_nodes: true,
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

struct NoImplicitPartialVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
}

fn is_renderable_object(node: &PrismNode) -> bool {
  if constructs_object(node) {
    return true;
  }

  let root = node.root_receiver();

  root.is("ConstantReadNode") || root.is("ConstantPathNode")
}

impl<'rule> NoImplicitPartialVisitor<'rule> {
  fn check_render(&mut self, node: &ERBRenderNode) {
    let call = match node.prism() {
      Some(call) => call,
      None => return,
    };

    if !is_output_render(node) || self.source.is_empty() {
      return;
    }

    let expression = match render_partial_expression(call) {
      Some(expression) if !expression.explicit => expression,
      _ => return,
    };

    if is_static_partial_path(expression.node) || expression.node.is("InterpolatedStringNode") || is_renderable_object(expression.node) {
      return;
    }

    let object = node
      .keywords
      .as_ref()
      .and_then(|keywords| keywords.object.as_ref())
      .map(|token| format!(" on `{}`", token.value))
      .unwrap_or_default();

    self.offenses.push(UnboundOffense::new(
      self.rule_name,
      format!(
        "Rails derives the partial from `to_partial_path`{object} when the template renders, so the template this renders is not named in this `<%= render %>` call. Name it explicitly, with `object:` for a single record or `collection:` for many, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them."
      ),
      location_from_offset(self.source, expression.node.start_offset, expression.node.end_offset),
    ));
  }
}

impl<'rule> Visitor for NoImplicitPartialVisitor<'rule> {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.check_render(node);

    self.walk_erb_render_node(node);
  }
}

impl ParserRule for ActionViewNoImplicitPartialRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = NoImplicitPartialVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
