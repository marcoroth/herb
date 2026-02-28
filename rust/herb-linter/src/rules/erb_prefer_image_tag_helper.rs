use crate::utils::tag_utils::{get_attribute, get_tag_name_from_open_tag};

use herb::nodes::*;
use herb::Visitor;

rule_visitor!(PreferImageTagHelperVisitor);
define_parser_rule!(ERBPreferImageTagHelperRule, "erb-prefer-image-tag-helper", Warning, PreferImageTagHelperVisitor);

impl PreferImageTagHelperVisitor {
  fn contains_erb_content(value_node: &HTMLAttributeValueNode) -> bool {
    value_node.children.iter().any(|child| matches!(child, AnyNode::ERBContentNode(_)))
  }

  fn is_only_erb_content(value_node: &HTMLAttributeValueNode) -> bool {
    !value_node.children.is_empty() && value_node.children.iter().all(|child| matches!(child, AnyNode::ERBContentNode(_)))
  }

  fn get_first_child_content(value_node: &HTMLAttributeValueNode) -> String {
    if let Some(AnyNode::LiteralNode(literal)) = value_node.children.first() {
      literal.content.trim().to_string()
    } else {
      String::new()
    }
  }

  fn is_data_uri(value_node: &HTMLAttributeValueNode) -> bool {
    Self::get_first_child_content(value_node).starts_with("data:")
  }

  fn is_full_url(value_node: &HTMLAttributeValueNode) -> bool {
    let content = Self::get_first_child_content(value_node);

    content.starts_with("http://") || content.starts_with("https://")
  }

  // TODO: use ERBToRubyStringPrinter from herb-printer to build the suggested expression
  fn build_suggested_expression(value_node: &HTMLAttributeValueNode) -> String {
    let has_literal = value_node.children.iter().any(|child| matches!(child, AnyNode::LiteralNode(_)));

    let has_erb = value_node.children.iter().any(|child| matches!(child, AnyNode::ERBContentNode(_)));

    if has_erb && !has_literal {
      let mut parts = Vec::new();

      for child in &value_node.children {
        if let AnyNode::ERBContentNode(erb) = child {
          if let Some(ref content) = erb.content {
            parts.push(content.value.trim().to_string());
          }
        }
      }

      if parts.is_empty() {
        return "expression".to_string();
      }

      if parts.len() == 1 {
        return parts.into_iter().next().unwrap();
      }

      let mut result = String::from("\"");

      for part in &parts {
        result.push_str(&format!("#{{{}}}", part));
      }

      result.push('"');

      return result;
    }

    let mut result = String::from("\"");

    for child in &value_node.children {
      match child {
        AnyNode::LiteralNode(literal) => {
          result.push_str(&literal.content);
        }
        AnyNode::ERBContentNode(erb) => {
          if let Some(ref content) = erb.content {
            result.push_str(&format!("#{{{}}}", content.value.trim()));
          }
        }
        _ => {}
      }
    }
    result.push('"');

    result
  }
}

impl Visitor for PreferImageTagHelperVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if tag_name.to_lowercase() != "img" {
        self.walk_html_open_tag_node(node);

        return;
      }

      if let Some(src_attribute) = get_attribute(node, "src") {
        if let Some(ref value_node) = src_attribute.value {
          if Self::contains_erb_content(value_node) {
            if Self::is_data_uri(value_node) {
              self.walk_html_open_tag_node(node);

              return;
            }

            let should_flag = Self::is_only_erb_content(value_node) || !Self::is_full_url(value_node);

            if should_flag {
              let suggested_expression = Self::build_suggested_expression(value_node);

              self.add_offense(
                format!(
                  "Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag {}, alt: \"...\" %>` instead.",
                  suggested_expression
                ),
                src_attribute.location.clone(),
              );
            }
          }
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
