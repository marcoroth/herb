use crate::herb_disable::parse_herb_disable_content;

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(MalformedVisitor);
define_parser_rule!(HerbDisableCommentMalformedRule, "herb-disable-comment-malformed", Error, MalformedVisitor);

impl Visitor for MalformedVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let opening_tag = match &node.tag_opening {
      Some(token) => &token.value,
      None => return,
    };

    if opening_tag != "<%#" {
      return;
    }

    let content = match &node.content {
      Some(token) => &token.value,
      None => return,
    };

    let trimmed = content.trim();

    if !trimmed.starts_with("herb:disable") {
      return;
    }

    if trimmed.len() > "herb:disable".len() {
      let char_after_prefix = trimmed.as_bytes()["herb:disable".len()];

      if char_after_prefix != b' ' && char_after_prefix != b'\t' && char_after_prefix != b'\n' {
        self.add_offense(
          "`herb:disable` comment is missing a space after `herb:disable`. Add a space before the rule names.",
          node.location.clone(),
        );

        return;
      }
    }

    let after_prefix = trimmed["herb:disable".len()..].trim();
    if after_prefix.is_empty() {
      return;
    }

    if parse_herb_disable_content(content).is_some() {
      return;
    }

    let rules_string = after_prefix.trim();

    let message = if rules_string.ends_with(',') {
      "`herb:disable` comment has a trailing comma. Remove the trailing comma."
    } else if rules_string.contains(",,") || has_consecutive_commas(rules_string) {
      "`herb:disable` comment has consecutive commas. Remove extra commas."
    } else if rules_string.starts_with(',') {
      "`herb:disable` comment starts with a comma. Remove the leading comma."
    } else {
      "`herb:disable` comment is malformed."
    };

    self.add_offense(message, node.location.clone());
  }
}

fn has_consecutive_commas(string: &str) -> bool {
  let mut previous_comma = false;

  for character in string.chars() {
    if character == ',' {
      if previous_comma {
        return true;
      }
      previous_comma = true;
    } else if character.is_whitespace() {
      // whitespace between commas still counts as consecutive
    } else {
      previous_comma = false;
    }
  }

  false
}
