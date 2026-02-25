use herb::nodes::HTMLConditionalElementNode;
use herb::Visitor;

rule_visitor!(NoConditionalHTMLElementVisitor);
define_parser_rule!(
  ERBNoConditionalHTMLElementRule,
  "erb-no-conditional-html-element",
  Error,
  NoConditionalHTMLElementVisitor
);

impl Visitor for NoConditionalHTMLElementVisitor {
  fn visit_html_conditional_element_node(&mut self, node: &HTMLConditionalElementNode) {
    let tag_name = node.tag_name.as_ref().map(|token| token.value.as_str()).unwrap_or("element");

    let condition = if node.condition.is_empty() { "condition" } else { &node.condition };

    let message = format!(
      "Avoid opening and closing `<{tag_name}>` tags in separate conditional blocks with the same condition. \
This pattern is difficult to read and maintain. Consider using a `capture` block instead:\n\n\
<% content = capture do %>\n  \
... your content here ...\n\
<% end %>\n\n\
<%= {condition} ? content_tag(:{tag_name}, content) : content %>"
    );

    self.add_offense(message, node.location.clone());

    self.walk_html_conditional_element_node(node);
  }
}
