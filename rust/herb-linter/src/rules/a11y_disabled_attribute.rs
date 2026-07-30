use crate::utils::tag_utils::{has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

const VALID_DISABLED_TAGS: &[&str] = &["button", "fieldset", "input", "optgroup", "option", "select", "textarea", "task-lists"];

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
        if !VALID_DISABLED_TAGS.contains(&tag_name.as_str()) {
          self.add_offense(
            format!("The `disabled` attribute is only valid on {}.", VALID_DISABLED_TAGS.join(", ")),
            tag_name_location(node),
          );
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
