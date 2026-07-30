use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::prism_utils::{is_call_on_local, is_debug_output_call};
use crate::utils::source_slice::location_from_offset;

use herb::nodes::{AnyNode, ERBContentNode, ERBRenderNode};
use herb::prism::PrismNode;
use herb::{ParseResult, Visitor};
use herb_config::{Severity, SeverityConfig};

const MUTATION_METHODS: &[&str] = &[
  "<<",
  "[]=",
  "push",
  "append",
  "prepend",
  "pop",
  "shift",
  "unshift",
  "delete",
  "clear",
  "replace",
  "insert",
  "concat",
  "assert_valid_keys",
];

const SIDE_EFFECT_METHODS: &[&str] = &[
  "content_for",
  "provide",
  "flush",
  "turbo_refreshes_with",
  "turbo_exempts_page_from_cache",
  "turbo_exempts_page_from_preview",
  "turbo_page_requires_reload",
];

const READ_NODES: &[&str] = &[
  "InstanceVariableReadNode",
  "ClassVariableReadNode",
  "GlobalVariableReadNode",
  "LocalVariableReadNode",
  "ConstantReadNode",
  "ConstantPathNode",
];

pub struct ERBNoUnusedExpressionsRule;

struct UnusedExpressionCollector<'node> {
  expressions: Vec<&'node PrismNode>,
  block_local_names: Vec<String>,
}

impl<'node> UnusedExpressionCollector<'node> {
  fn visit(&mut self, node: &'node PrismNode) {
    if node.is("ProgramNode") || node.is("StatementsNode") {
      for child in &node.children {
        self.visit(child);
      }

      return;
    }

    if node.node_type.ends_with("WriteNode") {
      return;
    }

    if self.is_unused_expression(node) {
      self.expressions.push(node);
    }
  }

  fn is_mutation_call(node: &PrismNode) -> bool {
    match node.name.as_deref() {
      Some(name) => name.ends_with('!') || MUTATION_METHODS.contains(&name),
      None => false,
    }
  }

  fn is_side_effect_call(node: &PrismNode) -> bool {
    if node.receiver().is_some() {
      return false;
    }

    node.name.as_deref().map(|name| SIDE_EFFECT_METHODS.contains(&name)).unwrap_or(false)
  }

  fn is_unused_expression(&self, node: &PrismNode) -> bool {
    if node.is("CallNode") {
      if node.has_block || Self::is_mutation_call(node) || Self::is_side_effect_call(node) || is_debug_output_call(node) {
        return false;
      }

      if !self.block_local_names.is_empty() && is_call_on_local(node, &self.block_local_names) {
        return false;
      }

      return true;
    }

    READ_NODES.contains(&node.node_type.as_str())
  }
}

struct ERBNoUnusedExpressionsVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
  render_block_local_names: Vec<String>,
}

impl<'rule> Visitor for ERBNoUnusedExpressionsVisitor<'rule> {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    let previous = self.render_block_local_names.clone();

    for argument in &node.block_arguments {
      if let AnyNode::RubyParameterNode(parameter) = argument {
        if let Some(ref name) = parameter.name {
          self.render_block_local_names.push(name.value.clone());
        }
      }
    }

    self.walk_erb_render_node(node);

    self.render_block_local_names = previous;
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if is_output_tag_opening(tag_opening) {
      return;
    }

    let prism_node = match node.prism_node_ast {
      Some(ref prism_node) => prism_node,
      None => return,
    };

    if self.source.is_empty() {
      return;
    }

    let mut collector = UnusedExpressionCollector {
      expressions: Vec::new(),
      block_local_names: self.render_block_local_names.clone(),
    };

    collector.visit(prism_node);

    for expression in collector.expressions {
      let expression_source = self.source.get(expression.start_offset..expression.end_offset).unwrap_or("");

      self.offenses.push(UnboundOffense::with_tags(
        self.rule_name,
        format!(
          "Avoid unused expressions in silent ERB tags. `{}` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
          expression_source
        ),
        location_from_offset(self.source, expression.start_offset, expression.end_offset),
        vec!["unnecessary".to_string()],
      ));
    }
  }
}

impl Rule for ERBNoUnusedExpressionsRule {
  fn name(&self) -> &'static str {
    "erb-no-unused-expressions"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::PerMode {
      cli: Severity::Error,
      editor: Severity::Info,
    }
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      render_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBNoUnusedExpressionsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = ERBNoUnusedExpressionsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
      render_block_local_names: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
