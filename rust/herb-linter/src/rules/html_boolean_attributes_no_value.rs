use crate::utils::html_data::is_boolean_attribute;
use crate::utils::tag_utils::{get_attribute_name, get_attributes, print_attribute, print_attribute_name};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(BooleanAttributesNoValueVisitor);
define_parser_rule!(
  HTMLBooleanAttributesNoValueRule,
  "html-boolean-attributes-no-value",
  Error,
  BooleanAttributesNoValueVisitor
);

impl Visitor for BooleanAttributesNoValueVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      if let Some(attribute_name) = get_attribute_name(attribute) {
        if !is_boolean_attribute(attribute_name) {
          continue;
        }

        if attribute.value.is_none() {
          continue;
        }

        let printed_name = print_attribute_name(attribute);
        let printed_attribute = print_attribute(attribute);

        self.add_offense(
          format!(
            "Boolean attribute `{}` should not have a value. Use `{}` instead of `{}`.",
            printed_name,
            attribute_name.to_lowercase(),
            printed_attribute
          ),
          attribute.value.as_ref().unwrap().location.clone(),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
