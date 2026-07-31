use crate::utils::aria_data::{LABEL_ATTRIBUTES, ROLES_WHICH_CANNOT_BE_NAMED};
use crate::utils::html_data::{GENERIC_ELEMENTS, NAME_RESTRICTED_ELEMENTS};
use crate::utils::tag_utils::{get_element_attribute, get_element_static_attribute_value, get_tag_local_name, has_element_attribute};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

rule_visitor!(NoAriaLabelMisuseVisitor);
define_parser_rule!(
  A11yNoAriaLabelMisuseRule,
  "a11y-no-aria-label-misuse",
  Warning,
  NoAriaLabelMisuseVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.10.2"
);

impl NoAriaLabelMisuseVisitor {
  fn check_element(&mut self, node: &HTMLElementNode) {
    let tag_name = match get_tag_local_name(node) {
      Some(tag_name) => tag_name,
      None => return,
    };

    for attribute_name in LABEL_ATTRIBUTES {
      let attribute = match get_element_attribute(node, attribute_name) {
        Some(attribute) => attribute,
        None => continue,
      };

      let location = attribute.location.clone();

      if NAME_RESTRICTED_ELEMENTS.contains(&tag_name.as_str()) {
        self.add_offense(
          format!(
            "The `{}` attribute must not be used on the `<{}>` element. Assistive technologies do not reliably support naming on this element. Use visible text content instead, or wrap the content in an element that supports naming.",
            attribute_name, tag_name
          ),
          location,
        );

        continue;
      }

      if !GENERIC_ELEMENTS.contains(&tag_name.as_str()) {
        continue;
      }

      if !has_element_attribute(node, "role") {
        self.add_offense(
          format!(
            "The `{}` attribute on `<{}>` requires a permitted ARIA `role`. Add a valid `role` attribute (e.g. `role=\"region\"`, `role=\"group\"`, or `role=\"img\"`), or use an interactive element like `<button>` or `<a>` instead.",
            attribute_name, tag_name
          ),
          location,
        );

        continue;
      }

      let role = match get_element_static_attribute_value(node, "role") {
        Some(role) => role,
        None => continue,
      };

      if ROLES_WHICH_CANNOT_BE_NAMED.contains(&role.as_str()) {
        self.add_offense(
          format!(
            "The `{}` attribute on `<{}>` is not allowed with ARIA role `{}` because that role cannot be named. Change the `role` to one that supports naming, or remove the `{}` attribute.",
            attribute_name, tag_name, role, attribute_name
          ),
          location,
        );
      }
    }
  }
}

impl Visitor for NoAriaLabelMisuseVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.check_element(node);
    self.walk_html_element_node(node);
  }
}
