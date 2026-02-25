use crate::utils::aria_data::ABSTRACT_ARIA_ROLES;
use crate::utils::tag_utils::{get_attribute, get_static_attribute_value};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoAbstractRolesVisitor);
define_parser_rule!(HTMLNoAbstractRolesRule, "html-no-abstract-roles", Error, NoAbstractRolesVisitor);

impl Visitor for NoAbstractRolesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(role_attribute) = get_attribute(node, "role") {
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

    self.walk_html_open_tag_node(node);
  }
}
