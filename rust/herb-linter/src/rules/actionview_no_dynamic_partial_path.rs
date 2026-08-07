use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_render;
use crate::utils::prism_utils::{is_static_partial_path, render_partial_expression};
use crate::utils::source_slice::location_from_offset;

use herb::nodes::ERBRenderNode;
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewNoDynamicPartialPathRule;

impl Rule for ActionViewNoDynamicPartialPathRule {
  fn name(&self) -> &'static str {
    "actionview-no-dynamic-partial-path"
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

struct NoDynamicPartialPathVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
}

fn describe(node: &PrismNode) -> &'static str {
  if node.is("InterpolatedStringNode") {
    return "The partial name is interpolated, so it is only known at runtime.";
  }

  "The partial name comes from a variable or method call, so it is only known at runtime."
}

impl<'rule> NoDynamicPartialPathVisitor<'rule> {
  fn check_render(&mut self, node: &ERBRenderNode) {
    let call = match node.prism() {
      Some(call) => call,
      None => return,
    };

    if !is_output_render(node) || self.source.is_empty() {
      return;
    }

    let expression = match render_partial_expression(call) {
      Some(expression) => expression,
      None => return,
    };

    if is_static_partial_path(expression.node) {
      return;
    }

    if !expression.explicit && !expression.node.is("InterpolatedStringNode") {
      return;
    }

    self.offenses.push(UnboundOffense::new(
      self.rule_name,
      format!(
        "{} Use a literal name, or branch between literal names, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them.",
        describe(expression.node)
      ),
      location_from_offset(self.source, expression.node.start_offset, expression.node.end_offset),
    ));
  }
}

impl<'rule> Visitor for NoDynamicPartialPathVisitor<'rule> {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.check_render(node);

    self.walk_erb_render_node(node);
  }
}

impl ParserRule for ActionViewNoDynamicPartialPathRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = NoDynamicPartialPathVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
