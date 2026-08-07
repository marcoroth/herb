use crate::utils::tag_utils::{get_attribute_in, get_static_attribute_value, has_attribute_in};

use herb::nodes::{AnyNode, ERBOpenTagNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(AriaRoleHeadingRequiresLevelVisitor);
define_parser_rule!(
  HTMLAriaRoleHeadingRequiresLevelRule,
  "html-aria-role-heading-requires-level",
  Warning,
  AriaRoleHeadingRequiresLevelVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.4.0"
);

impl AriaRoleHeadingRequiresLevelVisitor {
  fn check_children(&mut self, children: &[AnyNode]) {
    if let Some(role_attribute) = get_attribute_in(children, "role") {
      if let Some(role_value) = get_static_attribute_value(role_attribute) {
        if role_value == "heading" && !has_attribute_in(children, "aria-level") {
          self.add_offense(
            "Element with `role=\"heading\"` must have an `aria-level` attribute.".to_string(),
            role_attribute.location.clone(),
          );
        }
      }
    }
  }
}

impl Visitor for AriaRoleHeadingRequiresLevelVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_children(&node.children);
    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_children(&node.children);
    self.walk_erb_open_tag_node(node);
  }
}
