use crate::utils::tag_utils::get_attribute_name;

use herb::nodes::HTMLAttributeNode;
use herb::Visitor;

rule_visitor!(NoAccesskeyAttributeVisitor);
define_parser_rule!(
  A11yNoAccesskeyAttributeRule,
  "a11y-no-accesskey-attribute",
  Warning,
  NoAccesskeyAttributeVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true }
);

impl Visitor for NoAccesskeyAttributeVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    if get_attribute_name(node).as_deref() == Some("accesskey") {
      self.add_offense(
        "Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.",
        node.location.clone(),
      );
    }

    self.walk_html_attribute_node(node);
  }
}
