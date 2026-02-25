use crate::utils::tag_utils::{get_attribute_name_literal_content, get_attributes, print_attribute_name};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoUnderscoresInAttributeNamesVisitor);
define_parser_rule!(
  HTMLNoUnderscoresInAttributeNamesRule,
  "html-no-underscores-in-attribute-names",
  Warning,
  NoUnderscoresInAttributeNamesVisitor
);

impl Visitor for NoUnderscoresInAttributeNamesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      let checkable_name = match get_attribute_name_literal_content(attribute) {
        Some(name) => name,
        None => continue,
      };

      if checkable_name.contains('_') {
        let printed_name = print_attribute_name(attribute);
        let location = attribute
          .name
          .as_ref()
          .map(|name_node| name_node.location.clone())
          .unwrap_or_else(|| attribute.location.clone());

        self.add_offense(
          format!("Attribute `{}` should not contain underscores. Use hyphens (-) instead.", printed_name),
          location,
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
