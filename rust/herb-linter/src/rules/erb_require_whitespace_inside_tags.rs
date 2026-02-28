use herb::nodes::ERBNode;
use herb::Token;
use herb::Visitor;

rule_visitor!(RequireWhitespaceInsideTagsVisitor);
define_parser_rule!(
  ERBRequireWhitespaceInsideTagsRule,
  "erb-require-whitespace-inside-tags",
  Error,
  RequireWhitespaceInsideTagsVisitor
);

impl RequireWhitespaceInsideTagsVisitor {
  fn check_comment_tag_whitespace(&mut self, open_tag: &Token, close_tag: &Token, content: &str) {
    if !content.starts_with(' ') && !content.starts_with('\n') && !content.starts_with('=') {
      self.add_offense(format!("Add whitespace after `{}`.", open_tag.value), open_tag.location.clone());
    } else if content.starts_with('=') && content.len() > 1 {
      let second_byte = content.as_bytes()[1];

      if second_byte != b' ' && second_byte != b'\t' && second_byte != b'\n' && second_byte != b'\r' {
        self.add_offense("Add whitespace after `<%#=`.".to_string(), open_tag.location.clone());
      }
    }

    if !content.ends_with(' ') && !content.ends_with('\n') {
      self.add_offense(format!("Add whitespace before `{}`.", close_tag.value), close_tag.location.clone());
    }
  }

  fn check_open_tag_whitespace(&mut self, open_tag: &Token, content: &str) {
    if content.starts_with(' ') || content.starts_with('\n') {
      return;
    }

    self.add_offense(format!("Add whitespace after `{}`.", open_tag.value), open_tag.location.clone());
  }

  fn check_close_tag_whitespace(&mut self, close_tag: &Token, content: &str) {
    if content.ends_with(' ') || content.ends_with('\n') {
      return;
    }

    self.add_offense(format!("Add whitespace before `{}`.", close_tag.value), close_tag.location.clone());
  }
}

impl Visitor for RequireWhitespaceInsideTagsVisitor {
  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    let open_tag = match node.tag_opening() {
      Some(token) => token,
      None => return,
    };

    let close_tag = match node.tag_closing() {
      Some(token) => token,
      None => return,
    };

    let content_value = match node.content() {
      Some(token) => &token.value,
      None => return,
    };

    if open_tag.value == "<%#" {
      self.check_comment_tag_whitespace(open_tag, close_tag, content_value);
    } else {
      self.check_open_tag_whitespace(open_tag, content_value);
      self.check_close_tag_whitespace(close_tag, content_value);
    }
  }
}
