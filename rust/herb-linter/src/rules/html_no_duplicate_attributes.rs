use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::control_flow_tracker::{ControlFlowTracker, ControlFlowType};
use crate::utils::tag_utils::get_attribute_name;

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLNoDuplicateAttributesRule;

struct NoDuplicateAttributesVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  tag_attributes: HashSet<String>,
  tracker: ControlFlowTracker<HashSet<String>>,
}

impl NoDuplicateAttributesVisitor {
  fn handle_exit_control_flow(&mut self) {
    if let Some(exit_info) = self.tracker.exit_control_flow() {
      if exit_info.was_conditional {
        for attribute in &exit_info.values {
          self.tag_attributes.insert(attribute.clone());
        }
      }
    }
  }

  fn check_attribute(&mut self, attribute: &HTMLAttributeNode) {
    let identifier = match get_attribute_name(attribute) {
      Some(name) => name.to_lowercase(),
      None => return,
    };

    if !self.tracker.is_in_control_flow {
      if self.tag_attributes.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate attribute `{}`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.",
            identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      }

      self.tag_attributes.insert(identifier);

      return;
    }

    if self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
      if self.tracker.current_branch_values.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate attribute `{}` in same loop iteration. Each iteration will produce an element with duplicate attributes. Remove one or merge the values.",
            identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      } else if self.tag_attributes.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate attribute `{}`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.",
            identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      } else {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Attribute `{}` inside loop will appear multiple times on this element. Use a dynamic attribute name like `{}-<%= index %>` or move the attribute outside the loop.",
            identifier, identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      }
    } else {
      if self.tracker.current_branch_values.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate attribute `{}` in same branch. This branch will produce an element with duplicate attributes. Remove one or merge the values.",
            identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      } else if self.tag_attributes.contains(&identifier) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate attribute `{}`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.",
            identifier
          ),
          attribute.name.as_ref().unwrap().location.clone(),
        ));
      }

      self.tracker.control_flow_values.insert(identifier.clone());
    }

    self.tracker.current_branch_values.insert(identifier);
  }
}

impl Visitor for NoDuplicateAttributesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.tag_attributes = HashSet::new();
    self.tracker = ControlFlowTracker::new();
    self.walk_html_open_tag_node(node);
  }

  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    self.check_attribute(node);
  }

  impl_control_flow_visitor!(NoDuplicateAttributesVisitor, tracker);
}

impl Rule for HTMLNoDuplicateAttributesRule {
  fn name(&self) -> &'static str {
    "html-no-duplicate-attributes"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for HTMLNoDuplicateAttributesRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoDuplicateAttributesVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      tag_attributes: HashSet::new(),
      tracker: ControlFlowTracker::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
