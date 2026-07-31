use crate::autofix::{for_each_erb_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use herb::nodes::DocumentNode;
use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(CommentSyntaxVisitor);
define_parser_rule!(ERBCommentSyntaxRule, "erb-comment-syntax", Error, CommentSyntaxVisitor,
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "0.7.5"
);

impl Visitor for CommentSyntaxVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let content = match &node.content {
      Some(token) => &token.value,
      None => return,
    };

    if !content.starts_with(' ') || !content.trim_start_matches(' ').starts_with('#') {
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

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_erb_mut(document, &mut |tokens| {
    if !location_matches(tokens.location, offense) {
      return;
    }

    let opening = match tokens.tag_opening.as_mut() {
      Some(opening) => opening,
      None => return,
    };

    let content = match tokens.content.as_mut() {
      Some(content) => content,
      None => return,
    };

    opening.value = "<%#".to_string();

    // strip a leading `  #` so `<% # foo %>` becomes `<%# foo %>`
    let trimmed = content.value.trim_start_matches(' ');
    let spaces = content.value.len() - trimmed.len();

    if spaces > 0 && trimmed.starts_with('#') {
      content.value = content.value[spaces + 1..].to_string();
    }

    fixed = true;
  });

  fixed
}
