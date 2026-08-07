use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::source_slice::location_from_offset;

use herb::nodes::{AnyNode, ERBBlockNode, ERBForNode, ERBRenderNode};
use herb::Location;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoShadowedBlockArgumentRule;

impl Rule for ERBNoShadowedBlockArgumentRule {
  fn name(&self) -> &'static str {
    "erb-no-shadowed-block-argument"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

struct Binding {
  name: String,
  location: Location,
}

struct NoShadowedBlockArgumentVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  scopes: Vec<Vec<String>>,
  source: String,
}

impl NoShadowedBlockArgumentVisitor {
  fn bindings_from_parameters(parameters: &[AnyNode]) -> Vec<Binding> {
    parameters
      .iter()
      .filter_map(|parameter| match parameter {
        AnyNode::RubyParameterNode(parameter) => parameter.name.as_ref().map(|name| Binding {
          name: name.value.clone(),
          location: parameter.location.clone(),
        }),
        _ => None,
      })
      .collect()
  }

  fn bindings_from_for_loop(&self, node: &ERBForNode) -> Vec<Binding> {
    let prism_node = match node.prism() {
      Some(prism_node) if prism_node.is("ForNode") => prism_node,
      _ => return Vec::new(),
    };

    if self.source.is_empty() {
      return Vec::new();
    }

    // `ForNode` serializes its fields in order, so `index` is the first child
    let index = match prism_node.children.first() {
      Some(index) => index,
      None => return Vec::new(),
    };

    let targets: Vec<_> = if index.is("MultiTargetNode") {
      index.children.iter().collect()
    } else {
      vec![index]
    };

    targets
      .into_iter()
      .filter_map(|target| {
        target.name.as_ref().map(|name| Binding {
          name: name.clone(),
          location: location_from_offset(&self.source, target.start_offset, target.end_offset),
        })
      })
      .collect()
  }

  fn enter_scope(&mut self, bindings: Vec<Binding>) {
    let enclosing: Vec<&String> = self.scopes.iter().flatten().collect();

    for binding in &bindings {
      if !enclosing.iter().any(|name| *name == &binding.name) {
        continue;
      }

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "Block argument `{}` shadows an outer `{}`. Rename it so both remain reachable.",
          binding.name, binding.name
        ),
        binding.location.clone(),
      ));
    }

    self.scopes.push(bindings.into_iter().map(|binding| binding.name).collect());
  }

  fn exit_scope(&mut self) {
    self.scopes.pop();
  }
}

impl Visitor for NoShadowedBlockArgumentVisitor {
  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.enter_scope(Self::bindings_from_parameters(&node.block_arguments));
    self.walk_erb_block_node(node);
    self.exit_scope();
  }

  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.enter_scope(Self::bindings_from_parameters(&node.block_arguments));
    self.walk_erb_render_node(node);
    self.exit_scope();
  }

  fn visit_erb_for_node(&mut self, node: &ERBForNode) {
    let bindings = self.bindings_from_for_loop(node);

    self.enter_scope(bindings);
    self.walk_erb_for_node(node);
    self.exit_scope();
  }
}

impl ParserRule for ERBNoShadowedBlockArgumentRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let mut visitor = NoShadowedBlockArgumentVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      scopes: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
