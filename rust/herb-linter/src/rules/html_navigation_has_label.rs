use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag, has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NavigationHasLabelVisitor);
define_parser_rule!(HTMLNavigationHasLabelRule, "html-navigation-has-label", Error, NavigationHasLabelVisitor, enabled: false);

fn has_role_navigation(node: &HTMLOpenTagNode) -> bool {
  get_attribute(node, "role")
    .and_then(|attribute| get_static_attribute_value(attribute))
    .map(|value| value == "navigation")
    .unwrap_or(false)
}

impl Visitor for NavigationHasLabelVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    let tag_name = get_tag_name_from_open_tag(node);
    let is_nav_element = tag_name == Some("nav");
    let has_navigation_role = has_role_navigation(node);

    if is_nav_element || has_navigation_role {
      let has_aria_label = has_attribute(node, "aria-label");
      let has_aria_labelledby = has_attribute(node, "aria-labelledby");

      if !has_aria_label && !has_aria_labelledby {
        let mut message = "The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced.".to_string();

        if has_navigation_role && !is_nav_element {
          message.push_str(" Additionally, you can safely drop the `role=\"navigation\"` and replace it with the native HTML `<nav>` element.");
        }

        self.add_offense(message, tag_name_location(node));
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
