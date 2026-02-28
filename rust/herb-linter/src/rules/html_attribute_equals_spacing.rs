use herb::nodes::HTMLAttributeNode;
use herb::Visitor;

rule_visitor!(AttributeEqualsSpacingVisitor);
define_parser_rule!(
  HTMLAttributeEqualsSpacingRule,
  "html-attribute-equals-spacing",
  Error,
  AttributeEqualsSpacingVisitor
);

impl Visitor for AttributeEqualsSpacingVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    if node.name.is_none() || node.value.is_none() {
      self.walk_html_attribute_node(node);

      return;
    }

    if let Some(ref equals) = node.equals {
      if equals.value.starts_with(' ') {
        self.add_offense("Remove whitespace before `=` in HTML attribute".to_string(), equals.location.clone());
      }

      if equals.value.ends_with(' ') {
        self.add_offense("Remove whitespace after `=` in HTML attribute".to_string(), equals.location.clone());
      }
    }

    self.walk_html_attribute_node(node);
  }
}
