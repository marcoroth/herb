use crate::utils::aria_data::ABSTRACT_ARIA_ROLES;
use crate::utils::tag_utils::{get_attribute_in, get_static_attribute_value};

use herb::nodes::{AnyNode, ERBOpenTagNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(NoAbstractRolesVisitor);
define_parser_rule!(HTMLNoAbstractRolesRule, "html-no-abstract-roles", Warning, NoAbstractRolesVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.9.0"
);

impl NoAbstractRolesVisitor {
  fn check_children(&mut self, children: &[AnyNode]) {
    if let Some(role_attribute) = get_attribute_in(children, "role") {
      if let Some(role_value) = get_static_attribute_value(role_attribute) {
        if !role_value.is_empty() {
          let normalized_value = role_value.to_lowercase();

          if ABSTRACT_ARIA_ROLES.contains(normalized_value.as_str()) {
            self.add_offense(
              format!(
                "The `role` attribute must not use abstract ARIA role `{}`. Abstract roles are not meant to be used directly.",
                role_value
              ),
              role_attribute.location.clone(),
            );
          }
        }
      }
    }
  }
}

impl Visitor for NoAbstractRolesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_children(&node.children);
    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_children(&node.children);
    self.walk_erb_open_tag_node(node);
  }
}
