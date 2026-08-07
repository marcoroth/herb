use crate::utils::aria_data::ARIA_ATTRIBUTES;
use crate::utils::tag_utils::get_attribute_name;

use herb::nodes::{AnyNode, ERBOpenTagNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(AriaAttributeMustBeValidVisitor);
define_parser_rule!(
  HTMLAriaAttributeMustBeValidRule,
  "html-aria-attribute-must-be-valid",
  Warning,
  AriaAttributeMustBeValidVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.4.1"
);

impl AriaAttributeMustBeValidVisitor {
  fn check_children(&mut self, children: &[AnyNode]) {
    for attribute in children.iter().filter_map(|child| match child {
      AnyNode::HTMLAttributeNode(attribute) => Some(attribute.as_ref()),
      _ => None,
    }) {
      if let Some(name) = get_attribute_name(attribute) {
        let lowercase_name = name.to_lowercase();

        if !lowercase_name.starts_with("aria-") {
          continue;
        }

        if ARIA_ATTRIBUTES.contains(lowercase_name.as_str()) {
          continue;
        }

        self.add_offense(
          format!(
            "The attribute `{}` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.",
            lowercase_name
          ),
          attribute.location.clone(),
        );
      }
    }
  }
}

impl Visitor for AriaAttributeMustBeValidVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_children(&node.children);
    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_children(&node.children);
    self.walk_erb_open_tag_node(node);
  }
}
