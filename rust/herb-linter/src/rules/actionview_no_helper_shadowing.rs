use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::walk_prism;
use crate::utils::source_slice::location_from_offset;

use herb::nodes::{AnyNode, ERBBlockNode, ERBContentNode, ERBForNode, ERBRenderNode, ERBStrictLocalsNode};
use herb::prism::PrismNode;
use herb::Location;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const LOCAL_BINDING_PRISM_TYPES: &[&str] = &[
  "LocalVariableWriteNode",
  "LocalVariableAndWriteNode",
  "LocalVariableOrWriteNode",
  "LocalVariableOperatorWriteNode",
  "LocalVariableTargetNode",
];

pub struct ActionViewNoHelperShadowingRule;

impl Rule for ActionViewNoHelperShadowingRule {
  fn name(&self) -> &'static str {
    "actionview-no-helper-shadowing"
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
      strict_locals: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

fn helper_names(only_supported: bool) -> HashSet<&'static str> {
  let mut names = HashSet::new();

  for entry in herb::action_view_helpers::entries() {
    let include = if only_supported { entry.supported } else { entry.visibility == "public" };

    if !include {
      continue;
    }

    names.insert(entry.name);
    names.extend(entry.aliases.iter().copied());
  }

  names
}

struct NoHelperShadowingVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: String,
  all_helpers: HashSet<&'static str>,
  transformed_helpers: HashSet<&'static str>,
}

impl NoHelperShadowingVisitor {
  fn report(&mut self, name: &str, location: Location) {
    if !self.all_helpers.contains(name) {
      return;
    }

    let message = format!("Local variable `{name}` shadows the Action View `{name}` helper. Rename it to avoid confusion (for example `{name}_item`).");

    if self.transformed_helpers.contains(name) {
      self.offenses.push(UnboundOffense::new(self.rule_name, message, location));
    } else {
      self
        .offenses
        .push(UnboundOffense::with_severity(self.rule_name, message, location, Severity::Hint));
    }
  }

  fn check_parameters(&mut self, parameters: &[AnyNode]) {
    for parameter in parameters {
      if let AnyNode::RubyParameterNode(parameter) = parameter {
        if let Some(name) = parameter.name.as_ref() {
          self.report(&name.value.clone(), name.location.clone());
        }
      }
    }
  }

  fn collect_local_bindings(&mut self, prism_node: Option<&PrismNode>) {
    let prism_node = match prism_node {
      Some(prism_node) if !self.source.is_empty() => prism_node,
      _ => return,
    };

    let mut bindings = Vec::new();

    walk_prism(prism_node, &mut |node| {
      if LOCAL_BINDING_PRISM_TYPES.contains(&node.node_type.as_str()) {
        if let Some(name) = node.name.clone() {
          let (start, end) = node.field_location("name_loc").unwrap_or((node.start_offset, node.end_offset));

          bindings.push((name, start, end));
        }
      }

      true
    });

    for (name, start, end) in bindings {
      let location = location_from_offset(&self.source, start, end);

      self.report(&name, location);
    }
  }
}

impl Visitor for NoHelperShadowingVisitor {
  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.check_parameters(&node.block_arguments);
    self.walk_erb_block_node(node);
  }

  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.check_parameters(&node.block_arguments);
    self.walk_erb_render_node(node);
  }

  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    self.check_parameters(&node.locals);
    self.walk_erb_strict_locals_node(node);
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    self.collect_local_bindings(node.prism());
    self.walk_erb_content_node(node);
  }

  fn visit_erb_for_node(&mut self, node: &ERBForNode) {
    if let Some(prism_node) = node.prism() {
      if prism_node.is("ForNode") {
        let index = prism_node.field_one("index").cloned();

        if let Some(index) = index {
          self.collect_local_bindings(Some(&index));
        }
      }
    }

    self.walk_erb_for_node(node);
  }
}

impl ParserRule for ActionViewNoHelperShadowingRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let mut visitor = NoHelperShadowingVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
      all_helpers: helper_names(false),
      transformed_helpers: helper_names(true),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
