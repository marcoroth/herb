use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::control_flow_tracker::{ControlFlowTracker, ControlFlowType};
use crate::utils::tag_utils::{get_static_attribute_name, get_validatable_static_content, has_erb_output, is_effectively_static, print_output_content};

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct HTMLNoDuplicateIdsRule;

struct NoDuplicateIdsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  document_ids: HashSet<String>,
  tracker: ControlFlowTracker<HashSet<String>>,
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
          // Propagate IDs from nested conditional to parent control flow
          for id in exit_info.values {
            self.tracker.control_flow_values.insert(id);
          }
        }
      }
    }
  }

  fn is_static_id(&self, attribute: &HTMLAttributeNode) -> bool {
    let children = match attribute.value.as_ref() {
      Some(value_node) => &value_node.children,
      None => return true,
    };

    let is_completely_static = children.iter().all(|child| matches!(child, AnyNode::LiteralNode(_)));

    is_completely_static || is_effectively_static(children)
  }

  fn add_offense(&mut self, message: String, location: herb::Location) {
    self.offenses.push(UnboundOffense::new(self.rule_name, message, location));
  }

  fn check_attribute(&mut self, attribute: &HTMLAttributeNode) {
    if attribute.value.is_none() || get_static_attribute_name(attribute).as_deref() != Some("id") {
      return;
    }

    let children = &attribute.value.as_ref().unwrap().children;
    let is_dynamic = has_erb_output(children);

    if is_dynamic && self.tracker.is_in_control_flow && self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
      return;
    }

    let identifier = if is_effectively_static(children) {
      match get_validatable_static_content(children) {
        Some(value) => value,
        None => return,
      }
    } else {
      print_output_content(children)
    };

    if identifier.is_empty() {
      return;
    }

    if identifier.trim().is_empty() {
      return;
    }

    let location = attribute.location.clone();

    if !self.tracker.is_in_control_flow {
      if self.document_ids.contains(&identifier) {
        self.add_offense(format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier), location);
      } else {
        self.document_ids.insert(identifier);
      }

      return;
    }

    if self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
      if self.is_static_id(attribute) {
        self.add_offense(format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier), location);
      } else if self.tracker.current_branch_values.contains(&identifier) {
        self.add_offense(
          format!(
            "Duplicate ID `{}` found within the same loop iteration. IDs must be unique within the same loop iteration.",
            identifier
          ),
          location,
        );
      }
    } else if self.tracker.current_branch_values.contains(&identifier) {
      self.add_offense(
        format!(
          "Duplicate ID `{}` found within the same control flow branch. IDs must be unique within the same control flow branch.",
          identifier
        ),
        location,
      );
    } else if !is_dynamic {
      if self.document_ids.contains(&identifier) {
        self.add_offense(format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier), location);
      } else {
        self.tracker.control_flow_values.insert(identifier.clone());
      }
    }

    self.tracker.current_branch_values.insert(identifier);
  }
}

impl Visitor for NoDuplicateIdsVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    self.check_attribute(node);
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
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
