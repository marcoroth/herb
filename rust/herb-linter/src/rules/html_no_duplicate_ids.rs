use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::control_flow_tracker::{ControlFlowTracker, ControlFlowType};
use crate::utils::tag_utils::{get_attribute_name, get_static_attribute_value};

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

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
    if let Some(ref value_node) = attribute.value {
      return value_node.children.iter().all(|child| matches!(child, AnyNode::LiteralNode(_)));
    }

    true
  }

  fn check_attribute(&mut self, attribute: &HTMLAttributeNode) {
    let name = match get_attribute_name(attribute) {
      Some(name) => name,
      None => return,
    };

    if name.to_lowercase() != "id" {
      return;
    }

    let identifier = match get_static_attribute_value(attribute) {
      Some(value) => value,
      None => {
        if let Some(ref value_node) = attribute.value {
          let has_output_erb = value_node.children.iter().any(|child| {
            if let AnyNode::ERBContentNode(erb) = child {
              if let Some(ref opening) = erb.tag_opening {
                return opening.value.starts_with("<%=");
              }
            }

            false
          });

          if has_output_erb && self.tracker.is_in_control_flow && self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
            return;
          }

          // TODO: use IdentityPrinter from herb-printer to print the attribute value node
          let mut result = String::new();

          for child in &value_node.children {
            match child {
              AnyNode::LiteralNode(literal) => result.push_str(&literal.content),
              AnyNode::ERBContentNode(erb) => {
                if let Some(ref opening) = erb.tag_opening {
                  if opening.value.starts_with("<%=") {
                    result.push_str(&opening.value);

                    if let Some(ref content) = erb.content {
                      result.push_str(&content.value);
                    }

                    if let Some(ref closing) = erb.tag_closing {
                      result.push_str(&closing.value);
                    }
                  }
                }
              }
              _ => {}
            }
          }

          if result.is_empty() {
            return;
          }

          result
        } else {
          return;
        }
      }
    };

    if !identifier.is_empty() && identifier.trim().is_empty() {
      return;
    }

    if self.tracker.is_in_control_flow {
      if self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
        let is_static = self.is_static_id(attribute);

        if is_static {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier),
            attribute.location.clone(),
          ));

          return;
        }

        if self.tracker.current_branch_values.contains(&identifier) {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!(
              "Duplicate ID `{}` found within the same loop iteration. IDs must be unique within the same loop iteration.",
              identifier
            ),
            attribute.location.clone(),
          ));
        }
      } else {
        if self.tracker.current_branch_values.contains(&identifier) {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!(
              "Duplicate ID `{}` found within the same control flow branch. IDs must be unique within the same control flow branch.",
              identifier
            ),
            attribute.location.clone(),
          ));
        } else if self.document_ids.contains(&identifier) {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier),
            attribute.location.clone(),
          ));
        }

        self.tracker.control_flow_values.insert(identifier.clone());
      }

      self.tracker.current_branch_values.insert(identifier);
    } else {
      if self.document_ids.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!("Duplicate ID `{}` found. IDs must be unique within a document.", identifier),
          attribute.location.clone(),
        ));
      } else {
        self.document_ids.insert(identifier);
      }
    }
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

  fn default_severity(&self) -> Severity {
    Severity::Error
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
