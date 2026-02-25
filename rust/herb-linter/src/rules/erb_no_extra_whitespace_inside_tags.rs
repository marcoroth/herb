use herb::nodes::ERBNode;
use herb::Location;
use herb::Visitor;

rule_visitor!(NoExtraWhitespaceInsideTagsVisitor);
define_parser_rule!(
  ERBNoExtraWhitespaceInsideTagsRule,
  "erb-no-extra-whitespace-inside-tags",
  Error,
  NoExtraWhitespaceInsideTagsVisitor
);

impl Visitor for NoExtraWhitespaceInsideTagsVisitor {
  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    let open_tag = match node.tag_opening() {
      Some(token) => token,
      None => return,
    };

    let close_tag = match node.tag_closing() {
      Some(token) => token,
      None => return,
    };

    let content_token = match node.content() {
      Some(token) => token,
      None => return,
    };

    let content_value = &content_token.value;

    if content_value.starts_with("  ") && !content_value.starts_with("  \n") {
      let whitespace_length = content_value.len() - content_value.trim_start().len();
      let start_column = content_token.location.start.column;

      self.add_offense(
        format!("Remove extra whitespace after `{}`.", open_tag.value),
        Location::from(
          content_token.location.start.line,
          start_column,
          content_token.location.start.line,
          start_column + whitespace_length as u32,
        ),
      );
    }

    if open_tag.value == "<%#" && content_value.starts_with('=') && content_value.len() > 1 {
      let after_equals = &content_value[1..];
      if after_equals.starts_with("  ") && !after_equals.starts_with("  \n") && !after_equals.starts_with('\n') {
        let whitespace_length = after_equals.len() - after_equals.trim_start().len();
        let start_column = content_token.location.start.column + 1;

        self.add_offense(
          "Remove extra whitespace after `<%#=`.".to_string(),
          Location::from(
            content_token.location.start.line,
            start_column,
            content_token.location.start.line,
            start_column + whitespace_length as u32,
          ),
        );
      }
    }

    if !content_value.contains('\n') {
      let trimmed = content_value.trim_end();
      let trailing_whitespace_length = content_value.len() - trimmed.len();

      if trailing_whitespace_length >= 2 {
        let end_column = content_token.location.end.column;

        self.add_offense(
          format!("Remove extra whitespace before `{}`.", close_tag.value),
          Location::from(
            content_token.location.end.line,
            end_column - trailing_whitespace_length as u32,
            content_token.location.end.line,
            end_column,
          ),
        );
      }
    }
  }
}
