use crate::autofix::{for_each_erb_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::erb_utils::get_commented_tag_prefix;
use herb::nodes::DocumentNode;

use herb::nodes::ERBNode;
use herb::Token;
use herb::Visitor;
use herb_config::Severity;

rule_visitor!(RequireWhitespaceInsideTagsVisitor);
define_parser_rule!(
  ERBRequireWhitespaceInsideTagsRule,
  "erb-require-whitespace-inside-tags",
  Error,
  RequireWhitespaceInsideTagsVisitor,
  autocorrectable: true,
  autofix: autofix
);

impl RequireWhitespaceInsideTagsVisitor {
  fn check_comment_tag_whitespace(&mut self, open_tag: &Token, close_tag: &Token, content: &str) {
    match get_commented_tag_prefix(content) {
      Some(prefix) => {
        let after_prefix = &content[prefix.len()..];

        if !after_prefix.is_empty() && !after_prefix.starts_with(char::is_whitespace) {
          self.add_unsafe_offense_with_severity(
            format!("Add whitespace after `<%#{}`. This looks like a temporarily commented ERB tag.", prefix),
            open_tag.location.clone(),
            Severity::Info,
          );
        }
      }

      None => {
        if !content.starts_with(' ') && !content.starts_with('\n') {
          self.add_offense(format!("Add whitespace after `{}`.", open_tag.value), open_tag.location.clone());
        }
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

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_erb_mut(document, &mut |tokens| {
    let after_open = tokens
      .tag_opening
      .as_ref()
      .map(|token| location_matches(&token.location, offense))
      .unwrap_or(false);
    let before_close = tokens
      .tag_closing
      .as_ref()
      .map(|token| location_matches(&token.location, offense))
      .unwrap_or(false);

    if !after_open && !before_close {
      return;
    }

    let is_comment = tokens.tag_opening.as_ref().map(|token| token.value == "<%#").unwrap_or(false);

    let content = match tokens.content.as_mut() {
      Some(content) => content,
      None => return,
    };

    if before_close {
      content.value = format!("{} ", content.value);
      fixed = true;

      return;
    }

    match get_commented_tag_prefix(&content.value).filter(|_| is_comment) {
      Some(prefix) => content.value = format!("{} {}", prefix, &content.value[prefix.len()..]),
      None => content.value = format!(" {}", content.value),
    }

    fixed = true;
  });

  fixed
}
