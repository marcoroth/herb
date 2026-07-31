use crate::utils::html_data::DISABLEABLE_ELEMENTS;
use crate::utils::tag_utils::{has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(DisabledAttributeVisitor);
define_parser_rule!(
  A11yDisabledAttributeRule,
  "a11y-disabled-attribute",
  Warning,
  DisabledAttributeVisitor,
  enabled: false,
  introduced_in: "0.10.2"
);

impl Visitor for DisabledAttributeVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if has_attribute(node, "disabled") {
      if let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.to_lowercase()) {
        if !DISABLEABLE_ELEMENTS.contains(&tag_name.as_str()) {
          self.add_offense(
            format!("The `disabled` attribute is only valid on {}.", DISABLEABLE_ELEMENTS.join(", ")),
            tag_name_location(node),
          );
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
