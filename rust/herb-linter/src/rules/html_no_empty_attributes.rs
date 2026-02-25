use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute_name_literal_content, get_attributes, get_static_attribute_value, print_attribute, print_attribute_name};

use herb::nodes::{HTMLAttributeNode, HTMLOpenTagNode};
use herb::Visitor;

static RESTRICTED_ATTRIBUTES: LazyLock<HashSet<&'static str>> =
  LazyLock::new(|| ["id", "class", "name", "for", "src", "href", "title", "data", "role"].into_iter().collect());

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
      if tag_opening.value == "<%=" || tag_opening.value == "<%==" {
        self.has_output_content = true;
        return;
      }
    }

    self.walk_erb_content_node(node);
  }

  fn visit_erb_yield_node(&mut self, _node: &herb::nodes::ERBYieldNode) {
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

impl Visitor for NoEmptyAttributesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
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

    self.walk_html_open_tag_node(node);
  }
}

define_parser_rule!(HTMLNoEmptyAttributesRule, "html-no-empty-attributes", Warning, NoEmptyAttributesVisitor);
