use herb::nodes::HTMLOmittedCloseTagNode;
use herb::Visitor;

rule_visitor!(RequireClosingTagsVisitor);
define_parser_rule!(
  HTMLRequireClosingTagsRule,
  "html-require-closing-tags",
  Error,
  RequireClosingTagsVisitor,
  parser_options: { strict: false },
  introduced_in: "0.9.0"
);

impl Visitor for RequireClosingTagsVisitor {
  fn visit_html_omitted_close_tag_node(&mut self, node: &HTMLOmittedCloseTagNode) {
    if let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.as_str()) {
      self.add_offense(
        format!(
          "Missing explicit closing tag for `<{}>`. Use `</{}>` instead of relying on implicit tag closing.",
          tag_name, tag_name
        ),
        node.location.clone(),
      );
    }
  }
}
