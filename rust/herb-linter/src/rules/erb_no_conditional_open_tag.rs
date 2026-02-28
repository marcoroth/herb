use herb::nodes::HTMLConditionalOpenTagNode;
use herb::Visitor;

rule_visitor!(NoConditionalOpenTagVisitor);
define_parser_rule!(ERBNoConditionalOpenTagRule, "erb-no-conditional-open-tag", Error, NoConditionalOpenTagVisitor);

impl Visitor for NoConditionalOpenTagVisitor {
  fn visit_html_conditional_open_tag_node(&mut self, node: &HTMLConditionalOpenTagNode) {
    let tag_name = node.tag_name.as_ref().map(|token| token.value.as_str()).unwrap_or("element");

    self.add_offense(
      format!("Avoid using ERB conditionals to split the open and closing tag of `<{}>` element.", tag_name),
      node.location.clone(),
    );

    self.walk_html_conditional_open_tag_node(node);
  }
}
