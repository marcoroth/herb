use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::control_flow_tracker::{ControlFlowTracker, ControlFlowType};
use crate::utils::tag_utils::{get_static_attribute_name, get_tag_local_name, get_validatable_static_content, is_effectively_static, print_output_content};

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const IMPLICIT_BLOCK_PARAMETERS: &[&str] = &["it", "_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"];

pub struct HTMLNoDuplicateIdsRule;

fn is_erb_output(node: &AnyNode) -> bool {
  match node {
    AnyNode::ERBContentNode(erb) => erb
      .tag_opening
      .as_ref()
      .map(|token| token.value == "<%=" || token.value == "<%==")
      .unwrap_or(false),
    _ => false,
  }
}

/// Mirrors `hasDynamicOutput`, which counts ERB output tags and Ruby literals
/// that Action View helpers leave behind.
fn has_dynamic_output(children: &[AnyNode]) -> bool {
  children
    .iter()
    .any(|child| is_erb_output(child) || matches!(child, AnyNode::RubyLiteralNode(_)))
}

fn references_name(source: &str, name: &str) -> bool {
  let is_word = |character: char| character.is_ascii_alphanumeric() || character == '_';
  let mut consumed = 0;

  while let Some(index) = source[consumed..].find(name) {
    let start = consumed + index;
    let end = start + name.len();

    let before_ok = start == 0 || !source[..start].chars().next_back().is_some_and(is_word);
    let after_ok = source[end..].chars().next().is_none_or(|character| !is_word(character));

    if before_ok && after_ok {
      return true;
    }

    consumed = start + 1;
  }

  false
}

struct NoDuplicateIdsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  document_ids: HashSet<String>,
  tracker: ControlFlowTracker<HashSet<String>>,
  loop_variable_scopes: Vec<Vec<String>>,
}

impl NoDuplicateIdsVisitor {
  fn handle_exit_control_flow(&mut self) {
    if let Some(exit_info) = self.tracker.exit_control_flow() {
      if exit_info.was_conditional {
        if exit_info.returning_to_top_level {
          for id in &exit_info.values {
            self.document_ids.insert(id.clone());
          }
        } else {
          for id in exit_info.values {
            self.tracker.control_flow_values.insert(id);
          }
        }
      }
    }
  }

  fn add_offense(&mut self, message: String, location: herb::Location) {
    self.offenses.push(UnboundOffense::new(self.rule_name, message, location));
  }

  fn add_hint(&mut self, message: String, location: herb::Location) {
    self
      .offenses
      .push(UnboundOffense::with_severity(self.rule_name, message, location, Severity::Hint));
  }

  /// Whether the id embeds a variable bound by the enclosing iteration, which
  /// makes it differ on every pass.
  fn varies_per_iteration(&self, attribute: &HTMLAttributeNode) -> bool {
    let names = match self.loop_variable_scopes.last() {
      Some(names) if !names.is_empty() => names,
      _ => return false,
    };

    let children = match attribute.value.as_ref() {
      Some(value) => &value.children,
      None => return false,
    };

    children.iter().any(|child| {
      let code = match child {
        AnyNode::ERBContentNode(erb) if is_erb_output(child) => erb.content.as_ref().map(|token| token.value.clone()).unwrap_or_default(),
        AnyNode::RubyLiteralNode(literal) => literal.content.clone(),
        _ => return false,
      };

      names.iter().any(|name| references_name(&code, name))
    })
  }

  fn check_attribute(&mut self, attribute: &HTMLAttributeNode) {
    if attribute.value.is_none() || attribute.name.is_none() || get_static_attribute_name(attribute).as_deref() != Some("id") {
      return;
    }

    let children = &attribute.value.as_ref().unwrap().children;
    let is_dynamic = has_dynamic_output(children);

    let identifier = if is_dynamic {
      print_output_content(children)
    } else {
      match get_validatable_static_content(children) {
        Some(value) => value,
        None => return,
      }
    };

    if identifier.is_empty() || (!identifier.is_empty() && identifier.trim().is_empty()) {
      return;
    }

    let location = attribute.location.clone();

    if !self.tracker.is_in_control_flow {
      self.handle_global_id(&identifier, location, is_dynamic);

      return;
    }

    if self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
      self.handle_loop_id(&identifier, location, is_dynamic, attribute);
    } else {
      self.handle_conditional_id(&identifier, location, is_dynamic);
    }

    self.tracker.current_branch_values.insert(identifier);
  }

  fn handle_loop_id(&mut self, identifier: &str, location: herb::Location, is_dynamic: bool, attribute: &HTMLAttributeNode) {
    if self.tracker.current_branch_values.contains(identifier) {
      if is_dynamic {
        self.add_hint(
          format!(
            "Potential duplicate ID `{identifier}` found within the same loop iteration. If this expression evaluates to the same value, IDs must be unique."
          ),
          location,
        );
      } else {
        self.add_offense(
          format!("Duplicate ID `{identifier}` found within the same loop iteration. IDs must be unique within the same loop iteration."),
          location,
        );
      }

      return;
    }

    if !is_dynamic {
      self.add_offense(format!("Duplicate ID `{identifier}` found. IDs must be unique within a document."), location);

      return;
    }

    if !self.loop_variable_scopes.is_empty() && !self.varies_per_iteration(attribute) {
      self.add_offense(format!("Duplicate ID `{identifier}` found. IDs must be unique within a document."), location);
    }
  }

  fn handle_conditional_id(&mut self, identifier: &str, location: herb::Location, is_dynamic: bool) {
    if self.tracker.current_branch_values.contains(identifier) {
      if is_dynamic {
        self.add_hint(
          format!("Potential duplicate ID `{identifier}` found within the same control flow branch. If this expression evaluates to the same value, IDs must be unique."),
          location,
        );
      } else {
        self.add_offense(
          format!("Duplicate ID `{identifier}` found within the same control flow branch. IDs must be unique within the same control flow branch."),
          location,
        );
      }

      return;
    }

    if !is_dynamic && self.document_ids.contains(identifier) {
      self.add_offense(format!("Duplicate ID `{identifier}` found. IDs must be unique within a document."), location);

      return;
    }

    if !is_dynamic {
      self.tracker.control_flow_values.insert(identifier.to_string());
    }
  }

  fn handle_global_id(&mut self, identifier: &str, location: herb::Location, is_dynamic: bool) {
    if self.document_ids.contains(identifier) {
      if is_dynamic {
        self.add_hint(
          format!("Potential duplicate ID `{identifier}` found. If this expression evaluates to the same value, IDs must be unique within a document."),
          location,
        );
      } else {
        self.add_offense(format!("Duplicate ID `{identifier}` found. IDs must be unique within a document."), location);
      }

      return;
    }

    self.document_ids.insert(identifier.to_string());
  }

  /// A `<template>` holds a document fragment of its own, so ids inside it do
  /// not collide with the surrounding document.
  fn visit_template_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(herb::union_types::ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open_tag)) = node.open_tag.as_ref() {
      self.visit_html_open_tag_node(open_tag);
    }

    let previous_document_ids = std::mem::take(&mut self.document_ids);
    let previous_branch_values = std::mem::take(&mut self.tracker.current_branch_values);
    let previous_control_flow_values = std::mem::take(&mut self.tracker.control_flow_values);
    let previous_is_in_control_flow = self.tracker.is_in_control_flow;
    let previous_control_flow_type = self.tracker.current_control_flow_type;

    self.tracker.is_in_control_flow = false;
    self.tracker.current_control_flow_type = None;

    for child in &node.body {
      self.visit(child);
    }

    self.document_ids = previous_document_ids;
    self.tracker.current_branch_values = previous_branch_values;
    self.tracker.control_flow_values = previous_control_flow_values;
    self.tracker.is_in_control_flow = previous_is_in_control_flow;
    self.tracker.current_control_flow_type = previous_control_flow_type;

    if let Some(herb::union_types::ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(close_tag)) =
      node.close_tag.as_ref()
    {
      self.visit_html_close_tag_node(close_tag);
    }
  }
}

impl Visitor for NoDuplicateIdsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("template") {
      self.visit_template_element_node(node);

      return;
    }

    self.walk_html_element_node(node);
  }

  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    self.check_attribute(node);
  }

  fn visit_erb_iteration_block_node(&mut self, node: &ERBIterationBlockNode) {
    let declared: Vec<String> = node
      .block_arguments
      .iter()
      .filter_map(|argument| match argument {
        AnyNode::RubyParameterNode(parameter) => parameter.name.as_ref().map(|name| name.value.clone()),
        _ => None,
      })
      .collect();

    let names = if declared.is_empty() {
      IMPLICIT_BLOCK_PARAMETERS.iter().map(|name| name.to_string()).collect()
    } else {
      declared
    };

    self.tracker.enter_control_flow(ControlFlowType::Loop);
    self.loop_variable_scopes.push(names);

    self.walk_erb_iteration_block_node(node);

    self.loop_variable_scopes.pop();
    self.handle_exit_control_flow();
  }

  impl_control_flow_visitor!(NoDuplicateIdsVisitor, tracker);
}

impl Rule for HTMLNoDuplicateIdsRule {
  fn name(&self) -> &'static str {
    "html-no-duplicate-ids"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.4.1")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      iteration_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for HTMLNoDuplicateIdsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoDuplicateIdsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      document_ids: HashSet::new(),
      tracker: ControlFlowTracker::new(),
      loop_variable_scopes: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
