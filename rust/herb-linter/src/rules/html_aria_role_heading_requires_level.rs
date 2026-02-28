use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, has_attribute};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(AriaRoleHeadingRequiresLevelVisitor);
define_parser_rule!(
  HTMLAriaRoleHeadingRequiresLevelRule,
  "html-aria-role-heading-requires-level",
  Error,
  AriaRoleHeadingRequiresLevelVisitor
);

impl Visitor for AriaRoleHeadingRequiresLevelVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(role_attribute) = get_attribute(node, "role") {
      if let Some(role_value) = get_static_attribute_value(role_attribute) {
        if role_value == "heading" && !has_attribute(node, "aria-level") {
          self.add_offense(
            "Element with `role=\"heading\"` must have an `aria-level` attribute.".to_string(),
            role_attribute.location.clone(),
          );
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
