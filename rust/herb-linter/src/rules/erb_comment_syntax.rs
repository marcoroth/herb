use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(CommentSyntaxVisitor);
define_parser_rule!(ERBCommentSyntaxRule, "erb-comment-syntax", Error, CommentSyntaxVisitor);

impl Visitor for CommentSyntaxVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let content = match &node.content {
      Some(token) => &token.value,
      None => return,
    };

    if !content.starts_with(' ') {
      return;
    }

    if !content.trim_start().starts_with('#') {
      return;
    }

    let opening_tag = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("<%");

    let message = if content.contains("herb:disable") {
      format!(
        "Use `<%#` instead of `{} #` for `herb:disable` directives. Herb directives only work with ERB comment syntax (`<%# ... %>`).",
        opening_tag
      )
    } else {
      format!(
        "Use `<%#` instead of `{} #`. Ruby comments immediately after ERB tags can cause parsing issues.",
        opening_tag
      )
    };

    self.add_offense(message, node.location.clone());
  }
}
