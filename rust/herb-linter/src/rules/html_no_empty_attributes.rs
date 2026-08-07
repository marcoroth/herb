use crate::utils::html_data::RESTRICTED_ATTRIBUTES;

use crate::utils::tag_utils::{get_attribute_name_literal_content, get_static_attribute_value, print_attribute, print_attribute_name};

use herb::nodes::{AnyNode, ERBOpenTagNode, HTMLAttributeNode, HTMLOpenTagNode};
use herb::Visitor;

fn is_restricted_attribute(attribute_name: &str) -> bool {
  if RESTRICTED_ATTRIBUTES.contains(attribute_name) {
    return true;
  }

  if attribute_name.starts_with("data-") {
    return true;
  }

  if attribute_name.starts_with("aria-") {
    return true;
  }

  false
}

fn is_data_attribute(attribute_name: &str) -> bool {
  attribute_name.starts_with("data-")
}

struct ContainsOutputContentVisitor {
  has_output_content: bool,
}

impl Visitor for ContainsOutputContentVisitor {
  fn visit_literal_node(&mut self, node: &herb::nodes::LiteralNode) {
    if self.has_output_content {
      return;
    }

    if !node.content.trim().is_empty() {
      self.has_output_content = true;
    }
  }

  fn visit_erb_content_node(&mut self, node: &herb::nodes::ERBContentNode) {
    if self.has_output_content {
      return;
    }

    if let Some(ref tag_opening) = node.tag_opening {
      // an escaped tag renders as the literal `<%= ... %>` text, so it counts
      if tag_opening.value == "<%=" || tag_opening.value == "<%==" || tag_opening.value.starts_with("<%%") {
        self.has_output_content = true;
        return;
      }
    }

    self.walk_erb_content_node(node);
  }

  fn visit_erb_yield_node(&mut self, _node: &herb::nodes::ERBYieldNode) {
    self.has_output_content = true;
  }

  // Action View leaves an unresolvable value as a `RubyLiteralNode`, so the
  // attribute is not empty, it just cannot be read statically
  fn visit_ruby_literal_node(&mut self, _node: &herb::nodes::RubyLiteralNode) {
    self.has_output_content = true;
  }
}

fn contains_output_content(attribute: &HTMLAttributeNode) -> bool {
  let value_node = match &attribute.value {
    Some(value_node) => value_node,
    None => return false,
  };

  let mut visitor = ContainsOutputContentVisitor { has_output_content: false };

  for child in &value_node.children {
    visitor.visit(child);
    if visitor.has_output_content {
      return true;
    }
  }

  false
}

rule_visitor!(NoEmptyAttributesVisitor);

impl NoEmptyAttributesVisitor {
  fn check_children(&mut self, children: &[AnyNode], in_erb_open_tag: bool) {
    for attribute in children.iter().filter_map(|child| match child {
      AnyNode::HTMLAttributeNode(attribute) => Some(attribute.as_ref()),
      _ => None,
    }) {
      let effective_name = match get_attribute_name_literal_content(attribute) {
        Some(name) => name,
        None => continue,
      };

      let lowercase_name = effective_name.to_lowercase();

      if !is_restricted_attribute(&lowercase_name) {
        continue;
      }

      let attribute_value = match get_static_attribute_value(attribute) {
        Some(value) => value,
        None => {
          if contains_output_content(attribute) {
            continue;
          }

          if attribute.value.is_none() {
            continue;
          }

          String::new()
        }
      };

      if !attribute_value.trim().is_empty() {
        continue;
      }

      if contains_output_content(attribute) {
        continue;
      }

      let printed_name = print_attribute_name(attribute);
      let printed_attribute = print_attribute(attribute);

      if is_data_attribute(&lowercase_name) {
        // Action View drops empty data values, so there is nothing to report
        if in_erb_open_tag {
          continue;
        }

        if attribute.value.is_some() {
          self.add_offense(
            format!(
              "Data attribute `{}` should not have an empty value. Either provide a meaningful value or use `{}` instead of `{}`.",
              printed_name, printed_name, printed_attribute
            ),
            attribute.location.clone(),
          );
        }

        continue;
      }

      self.add_offense(
        format!(
          "Attribute `{}` must not be empty. Either provide a meaningful value or remove the attribute entirely.",
          printed_name
        ),
        attribute.location.clone(),
      );
    }
  }
}

impl Visitor for NoEmptyAttributesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_children(&node.children, false);
    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_children(&node.children, true);
    self.walk_erb_open_tag_node(node);
  }
}

define_parser_rule!(HTMLNoEmptyAttributesRule, "html-no-empty-attributes", Warning, NoEmptyAttributesVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.7.0"
);
