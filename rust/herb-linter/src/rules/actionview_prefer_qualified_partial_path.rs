use std::sync::Arc;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_render;
use crate::utils::prism_utils::render_partial_expression;
use crate::utils::source_slice::location_from_offset;

use herb::action_view_partial_index::PartialIndex;
use herb::action_view_partial_resolution::partial_name_for_file;
use herb::nodes::ERBRenderNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewPreferQualifiedPartialPathRule;

impl Rule for ActionViewPreferQualifiedPartialPathRule {
  fn name(&self) -> &'static str {
    "actionview-prefer-qualified-partial-path"
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

struct PreferQualifiedPartialPathVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
  file_name: Option<&'rule str>,
  partials: Option<&'rule Arc<PartialIndex>>,
}

impl<'rule> PreferQualifiedPartialPathVisitor<'rule> {
  fn qualified_name_for(&self, name: &str) -> Option<String> {
    let partials = self.partials?;
    let declaration = partials.lookup(name, self.file_name)?;

    partial_name_for_file(&declaration.file, &partials.view_root)
  }

  fn advice(&self, name: &str) -> String {
    match self.qualified_name_for(name) {
      Some(qualified) => {
        format!("Write it as `{qualified}` so it resolves to the same file from any template, and a search for `{qualified}` finds every caller.")
      }
      None => {
        "Write the full path from the view root so it resolves to the same file from any template, and a search for that path finds every caller.".to_string()
      }
    }
  }

  fn check_render(&mut self, node: &ERBRenderNode) {
    let call = match node.prism() {
      Some(call) => call,
      None => return,
    };

    if !is_output_render(node) || self.source.is_empty() {
      return;
    }

    let expression = match render_partial_expression(call) {
      Some(expression) if expression.node.is("StringNode") => expression,
      _ => return,
    };

    let name = match expression.node.unescaped.as_deref() {
      Some(name) if !name.is_empty() && !name.contains('/') => name.to_string(),
      _ => return,
    };

    self.offenses.push(UnboundOffense::new(
      self.rule_name,
      format!(
        "The partial `{name}` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. {}",
        self.advice(&name)
      ),
      location_from_offset(self.source, expression.node.start_offset, expression.node.end_offset),
    ));
  }
}

impl<'rule> Visitor for PreferQualifiedPartialPathVisitor<'rule> {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.check_render(node);

    self.walk_erb_render_node(node);
  }
}

impl ParserRule for ActionViewPreferQualifiedPartialPathRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = PreferQualifiedPartialPathVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
      file_name: context.file_name.as_deref(),
      partials: context.partials.as_ref(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
