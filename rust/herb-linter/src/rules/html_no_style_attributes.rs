use crate::utils::tag_utils::get_attribute_name;

use herb::nodes::HTMLAttributeNode;
use herb::Visitor;

rule_visitor!(NoStyleAttributesVisitor);
define_parser_rule!(
  HTMLNoStyleAttributesRule,
  "html-no-style-attributes",
  Error,
  NoStyleAttributesVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "unreleased"
);

impl Visitor for NoStyleAttributesVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    if get_attribute_name(node).as_deref() == Some("style") {
      self.add_offense(
        "Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.",
        node.location.clone(),
      );
    }

    self.walk_html_attribute_node(node);
  }
}
