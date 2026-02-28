use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute, get_open_tag, get_static_attribute_value, get_tag_name_from_element};

use herb::nodes::*;
use herb::union_types::ERBElseNodeOrERBIfNode;
use herb::Visitor;

rule_visitor!(NoEmptyHeadingsVisitor);
define_parser_rule!(HTMLNoEmptyHeadingsRule, "html-no-empty-headings", Error, NoEmptyHeadingsVisitor);

static HEADING_TAGS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| ["h1", "h2", "h3", "h4", "h5", "h6"].into_iter().collect());

impl NoEmptyHeadingsVisitor {
  fn has_heading_role(&self, open_tag: &HTMLOpenTagNode) -> bool {
    if let Some(role_attribute) = get_attribute(open_tag, "role") {
      if let Some(value) = get_static_attribute_value(role_attribute) {
        return value == "heading";
      }
    }
    false
  }

  fn is_empty_heading(&self, node: &HTMLElementNode) -> bool {
    if node.body.is_empty() {
      return true;
    }

    !self.has_accessible_content(&node.body)
  }

  fn has_accessible_content(&self, nodes: &[AnyNode]) -> bool {
    for child in nodes {
      match child {
        AnyNode::LiteralNode(literal) => {
          if !literal.content.trim().is_empty() {
            return true;
          }
        }

        AnyNode::HTMLTextNode(text) => {
          if !text.content.trim().is_empty() {
            return true;
          }
        }

        AnyNode::HTMLElementNode(element) => {
          if self.is_element_accessible(element) {
            return true;
          }
        }

        AnyNode::ERBContentNode(erb) => {
          if let Some(ref tag_opening) = erb.tag_opening {
            if tag_opening.value == "<%=" || tag_opening.value == "<%==" {
              return true;
            }
          }
        }

        AnyNode::ERBIfNode(node) => {
          if self.has_accessible_content(&node.statements) {
            return true;
          }

          if self.has_accessible_content_in_subsequent(&node.subsequent) {
            return true;
          }
        }

        AnyNode::ERBUnlessNode(node) => {
          if self.has_accessible_content(&node.statements) {
            return true;
          }

          if let Some(ref else_node) = node.else_clause {
            if self.has_accessible_content(&else_node.statements) {
              return true;
            }
          }
        }

        AnyNode::ERBCaseNode(node) => {
          if self.has_accessible_content_in_case_conditions(&node.conditions) {
            return true;
          }

          if let Some(ref else_node) = node.else_clause {
            if self.has_accessible_content(&else_node.statements) {
              return true;
            }
          }
        }

        AnyNode::ERBBlockNode(node) => {
          if self.has_accessible_content(&node.body) {
            return true;
          }
        }

        AnyNode::ERBForNode(node) => {
          if self.has_accessible_content(&node.statements) {
            return true;
          }
        }

        AnyNode::ERBWhileNode(node) => {
          if self.has_accessible_content(&node.statements) {
            return true;
          }
        }

        AnyNode::ERBUntilNode(node) => {
          if self.has_accessible_content(&node.statements) {
            return true;
          }
        }
        _ => {}
      }
    }
    false
  }

  fn has_accessible_content_in_subsequent(&self, subsequent: &Option<ERBElseNodeOrERBIfNode>) -> bool {
    match subsequent {
      Some(ERBElseNodeOrERBIfNode::ERBElseNode(else_node)) => self.has_accessible_content(&else_node.statements),
      Some(ERBElseNodeOrERBIfNode::ERBIfNode(if_node)) => {
        self.has_accessible_content(&if_node.statements) || self.has_accessible_content_in_subsequent(&if_node.subsequent)
      }
      None => false,
    }
  }

  fn has_accessible_content_in_case_conditions(&self, conditions: &[AnyNode]) -> bool {
    for condition in conditions {
      if let AnyNode::ERBWhenNode(when_node) = condition {
        if self.has_accessible_content(&when_node.statements) {
          return true;
        }
      }
    }

    false
  }

  fn is_element_accessible(&self, node: &HTMLElementNode) -> bool {
    if let Some(open_tag) = get_open_tag(node) {
      if let Some(aria_hidden) = get_attribute(open_tag, "aria-hidden") {
        if let Some(value) = get_static_attribute_value(aria_hidden) {
          if value == "true" {
            return false;
          }
        }
      }
    }

    if node.body.is_empty() {
      return false;
    }

    self.has_accessible_content(&node.body)
  }
}

impl Visitor for NoEmptyHeadingsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(tag_name) = get_tag_name_from_element(node) {
      let lowercase = tag_name.to_lowercase();

      if lowercase == "template" {
        return;
      }

      let is_standard_heading = HEADING_TAGS.contains(lowercase.as_str());

      let is_aria_heading = if let Some(open_tag) = get_open_tag(node) {
        self.has_heading_role(open_tag)
      } else {
        false
      };

      if (is_standard_heading || is_aria_heading) && self.is_empty_heading(node) {
        let element_description = if is_standard_heading {
          format!("`<{}>`", lowercase)
        } else {
          format!("`<{} role=\"heading\">`", lowercase)
        };

        self.add_offense(
          format!(
            "Heading element {} must not be empty. Provide accessible text content for screen readers and SEO.",
            element_description
          ),
          node.location.clone(),
        );
      }
    }

    self.walk_html_element_node(node);
  }
}
