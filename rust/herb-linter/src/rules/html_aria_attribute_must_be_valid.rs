use crate::utils::aria_data::ARIA_ATTRIBUTES;
use crate::utils::tag_utils::{get_attribute_name, get_attributes};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(AriaAttributeMustBeValidVisitor);
define_parser_rule!(
  HTMLAriaAttributeMustBeValidRule,
  "html-aria-attribute-must-be-valid",
  Warning,
  AriaAttributeMustBeValidVisitor,
  introduced_in: "0.4.1"
);

impl Visitor for AriaAttributeMustBeValidVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
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

    self.walk_html_open_tag_node(node);
  }
}
