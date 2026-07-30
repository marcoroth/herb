use crate::autofix::{for_each_erb_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::erb_utils::{get_commented_tag_prefix, leading_whitespace_length, trailing_whitespace_length};
use herb::nodes::DocumentNode;

use herb::nodes::ERBNode;
use herb::Location;
use herb::Visitor;
use herb_config::Severity;

rule_visitor!(NoExtraWhitespaceInsideTagsVisitor);
define_parser_rule!(
  ERBNoExtraWhitespaceInsideTagsRule,
  "erb-no-extra-whitespace-inside-tags",
  Error,
  NoExtraWhitespaceInsideTagsVisitor,
  autocorrectable: true,
  autofix: autofix
);

impl NoExtraWhitespaceInsideTagsVisitor {
  fn whitespace_start_location(&self, content: &str, content_location: &Location, offset: usize) -> Location {
    let length = leading_whitespace_length(&content[offset..]);
    let start_column = content_location.start.column + offset as u32;

    Location::from(
      content_location.start.line,
      start_column,
      content_location.start.line,
      start_column + length as u32,
    )
  }
}

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

    let content = &content_token.value;
    let content_location = &content_token.location;

    if content.starts_with("  ") && !content.starts_with("  \n") {
      self.add_offense(
        format!("Remove extra whitespace after `{}`.", open_tag.value),
        self.whitespace_start_location(content, content_location, 0),
      );
    }

    if open_tag.value == "<%#" {
      if let Some(prefix) = get_commented_tag_prefix(content) {
        let after_prefix = &content[prefix.len()..];
        let tag = format!("<%#{}", prefix);

        let has_extra_whitespace = leading_whitespace_length(after_prefix) >= 2 && !after_prefix.starts_with("  \n") && !after_prefix.starts_with('\n');

        if has_extra_whitespace {
          self.add_offense_with_severity(
            format!("Remove extra whitespace after `{}`. This looks like a temporarily commented ERB tag.", tag),
            self.whitespace_start_location(content, content_location, prefix.len()),
            Severity::Info,
          );
        } else {
          self.add_offense_with_severity(
            format!("`{}` looks like a temporarily commented ERB tag.", tag),
            open_tag.location.clone(),
            Severity::Info,
          );
        }
      }
    }

    if !content.contains('\n') {
      let length = trailing_whitespace_length(content);

      if length >= 2 {
        self.add_offense(
          format!("Remove extra whitespace before `{}`.", close_tag.value),
          Location::from(
            content_location.end.line,
            content_location.end.column - length as u32,
            content_location.end.line,
            content_location.end.column,
          ),
        );
      }
    }
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_erb_mut(document, &mut |tokens| {
    let content_location = match tokens.content.as_ref() {
      Some(content) => content.location.clone(),
      None => return,
    };

    let starts_at_content = offense.location.start.line == content_location.start.line && offense.location.start.column == content_location.start.column;

    let ends_at_content = offense.location.end.line == content_location.end.line && offense.location.end.column == content_location.end.column;

    let at_open_tag = tokens
      .tag_opening
      .as_ref()
      .map(|token| location_matches(&token.location, offense))
      .unwrap_or(false);

    let within_content =
      offense.location.start.line == content_location.start.line && offense.location.start.column > content_location.start.column && !ends_at_content;

    if !starts_at_content && !ends_at_content && !at_open_tag && !within_content {
      return;
    }

    let content = match tokens.content.as_mut() {
      Some(content) => content,
      None => return,
    };

    if ends_at_content && !starts_at_content {
      let trimmed = content.value.trim_end();

      if content.value.len() - trimmed.len() >= 2 {
        content.value = format!("{} ", trimmed);
        fixed = true;
      }

      return;
    }

    if starts_at_content {
      let trimmed = content.value.trim_start();

      if content.value.len() - trimmed.len() >= 2 {
        content.value = format!(" {}", trimmed);
        fixed = true;
      }

      return;
    }

    if let Some(prefix) = get_commented_tag_prefix(&content.value) {
      let after_prefix = content.value[prefix.len()..].trim_start();
      content.value = format!("{} {}", prefix, after_prefix);
      fixed = true;
    }
  });

  fixed
}
