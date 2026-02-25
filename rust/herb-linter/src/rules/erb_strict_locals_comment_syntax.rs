use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::ERBContentNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct ERBStrictLocalsCommentSyntaxRule;

fn is_word_char(character: char) -> bool {
  character.is_alphanumeric() || character == '_'
}

fn strip_locals_prefix(content: &str) -> Option<&str> {
  let rest = if content.starts_with("locals") {
    &content["locals".len()..]
  } else if content.starts_with("local") {
    &content["local".len()..]
  } else {
    return None;
  };

  if rest.chars().next().map_or(false, |ch| is_word_char(ch)) {
    return None;
  }

  Some(rest)
}

fn is_valid_strict_locals_format(content: &str) -> bool {
  let rest = match content.strip_prefix("locals:") {
    Some(after_prefix) => after_prefix,
    None => return false,
  };

  match rest.chars().next() {
    Some(ch) if ch.is_whitespace() => {}
    _ => return false,
  }

  let trimmed = rest.trim();

  trimmed.starts_with('(') && trimmed.ends_with(')')
}

fn extract_locals_remainder(content: &str) -> Option<&str> {
  strip_locals_prefix(content)
}

fn has_locals_like_syntax(remainder: &str) -> bool {
  remainder.contains('(') || remainder.contains(':') || remainder.contains(')')
}

fn looks_like_locals_declaration(content: &str) -> bool {
  strip_locals_prefix(content).is_some() && has_locals_like_syntax(content)
}

fn has_balanced_parentheses(content: &str) -> bool {
  let mut depth: i32 = 0;

  for character in content.chars() {
    if character == '(' {
      depth += 1;
    }

    if character == ')' {
      depth -= 1;
    }

    if depth < 0 {
      return false;
    }
  }

  depth == 0
}

fn split_by_top_level_comma(string: &str) -> Vec<&str> {
  let mut result = Vec::new();
  let mut start = 0;
  let mut paren_depth = 0i32;
  let mut bracket_depth = 0i32;
  let mut brace_depth = 0i32;
  let mut in_string = false;
  let mut string_char = ' ';
  let bytes = string.as_bytes();

  for index in 0..bytes.len() {
    let character = bytes[index] as char;
    let previous_character = if index > 0 { bytes[index - 1] as char } else { '\0' };

    if (character == '"' || character == '\'') && previous_character != '\\' {
      if !in_string {
        in_string = true;
        string_char = character;
      } else if character == string_char {
        in_string = false;
      }
    }

    if !in_string {
      match character {
        '(' => paren_depth += 1,
        ')' => paren_depth -= 1,
        '[' => bracket_depth += 1,
        ']' => bracket_depth -= 1,
        '{' => brace_depth += 1,
        '}' => brace_depth -= 1,
        ',' if paren_depth == 0 && bracket_depth == 0 && brace_depth == 0 => {
          result.push(&string[start..index]);
          start = index + 1;
          continue;
        }
        _ => {}
      }
    }
  }

  if start < string.len() {
    result.push(&string[start..]);
  }

  result
}

fn is_valid_double_splat(string: &str) -> bool {
  match string.strip_prefix("**") {
    Some(rest) => !rest.is_empty() && rest.chars().all(is_word_char),
    None => false,
  }
}

fn is_keyword_arg(string: &str) -> bool {
  let mut characters = string.chars();

  match characters.next() {
    Some(character) if is_word_char(character) => {}
    _ => return false,
  }

  for character in characters {
    if character == ':' {
      return true;
    }

    if !is_word_char(character) {
      return false;
    }
  }

  false
}

fn is_positional_arg(string: &str) -> bool {
  !string.is_empty() && string.chars().all(is_word_char)
}

fn validate_parameter(param: &str) -> Option<String> {
  let trimmed = param.trim();
  if trimmed.is_empty() {
    return None;
  }

  if trimmed.starts_with('&') {
    return Some(format!(
      "Block argument `{}` is not allowed. Strict locals only support keyword arguments.",
      trimmed
    ));
  }

  if trimmed.starts_with("**") {
    if is_valid_double_splat(trimmed) {
      return None;
    }

    return Some(format!(
      "Invalid double-splat syntax `{}`. Use `**name` format (e.g., `**attributes`).",
      trimmed
    ));
  }

  if trimmed.starts_with('*') {
    return Some(format!(
      "Splat argument `{}` is not allowed. Strict locals only support keyword arguments.",
      trimmed
    ));
  }

  if !is_keyword_arg(trimmed) {
    if is_positional_arg(trimmed) {
      return Some(format!(
        "Positional argument `{}` is not allowed. Use keyword argument format: `{}:`.",
        trimmed, trimmed
      ));
    }

    return Some(format!(
      "Invalid parameter `{}`. Use keyword argument format: `name:` or `name: default`.",
      trimmed
    ));
  }

  None
}

fn extract_params_inner(params_content: &str) -> Option<&str> {
  let trimmed = params_content.trim();

  if trimmed.starts_with('(') && trimmed.ends_with(')') {
    Some(&trimmed[1..trimmed.len() - 1])
  } else {
    None
  }
}

fn validate_locals_signature(params_content: &str) -> Option<String> {
  let inner = extract_params_inner(params_content)?.trim();

  if inner.is_empty() {
    return None;
  }

  if inner.starts_with(',') || inner.ends_with(',') || inner.contains(",,") {
    return Some("Unexpected comma in `locals:` parameters.".to_string());
  }

  let params = split_by_top_level_comma(inner);
  for param in params {
    if let Some(error) = validate_parameter(param) {
      return Some(error);
    }
  }

  None
}

fn extract_locals_params(content: &str) -> Option<&str> {
  let rest = content.strip_prefix("locals:")?;
  let trimmed = rest.trim();

  if trimmed.starts_with('(') && trimmed.ends_with(')') {
    Some(trimmed)
  } else {
    None
  }
}

fn extract_ruby_comment(content: &str) -> Option<&str> {
  let after_ws = content.trim_start();
  let after_hash = after_ws.strip_prefix('#')?;
  let comment = after_hash.trim_start();
  let line_end = comment.find('\n').unwrap_or(comment.len());
  Some(&comment[..line_end])
}

fn is_partial_file_opt(file_name: Option<&str>) -> Option<bool> {
  Some(crate::utils::file_utils::is_partial_file(file_name?))
}

struct StrictLocalsCommentSyntaxVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  context: &'rule LintContext,
  seen_strict_locals_comment: bool,
  first_strict_locals_line: Option<u32>,
}

impl<'rule> Visitor for StrictLocalsCommentSyntaxVisitor<'rule> {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let opening_tag = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    let content = match &node.content {
      Some(token) => token.value.as_str(),
      None => return,
    };

    let comment_content = if opening_tag == "<%#" {
      Some(content.trim().to_string())
    } else if opening_tag == "<%" || opening_tag == "<%-" {
      if let Some(ruby_comment) = extract_ruby_comment(content) {
        let ruby_comment = ruby_comment.trim();

        if !ruby_comment.is_empty() && looks_like_locals_declaration(ruby_comment) {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!(
              "Use `<%#` instead of `{} #` for strict locals comments. Only ERB comment syntax is recognized by Rails.",
              opening_tag
            ),
            node.location.clone(),
          ));
        }
      }
      None
    } else {
      None
    };

    let comment_content = match comment_content {
      Some(content) => content,
      None => return,
    };

    let remainder = match extract_locals_remainder(&comment_content) {
      Some(remainder) => remainder,
      None => return,
    };

    if !has_locals_like_syntax(remainder) {
      return;
    }

    if let Some(false) = is_partial_file_opt(self.context.file_name.as_deref()) {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Strict locals (`locals:`) only work in partials (files starting with `_`). This declaration will be ignored.",
        node.location.clone(),
      ));
    }

    if !has_balanced_parentheses(&comment_content) {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Unbalanced parentheses in `locals:` comment. Ensure all opening parentheses have matching closing parentheses.",
        node.location.clone(),
      ));

      return;
    }

    if is_valid_strict_locals_format(&comment_content) {
      if self.seen_strict_locals_comment {
        let first_line = self.first_strict_locals_line.unwrap_or(0);

        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate `locals:` declaration. Only one `locals:` comment is allowed per partial (first declaration at line {}).",
            first_line
          ),
          node.location.clone(),
        ));

        return;
      }

      self.seen_strict_locals_comment = true;
      self.first_strict_locals_line = Some(node.location.start.line);

      if let Some(params) = extract_locals_params(&comment_content) {
        if let Some(error) = validate_locals_signature(params) {
          self.offenses.push(UnboundOffense::new(self.rule_name, error, node.location.clone()));
        }
      }
    } else {
      if comment_content.starts_with("locals(") {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          "Use `locals:` with a colon, not `locals()`. Correct format: `<%# locals: (...) %>`.",
          node.location.clone(),
        ));
      } else if comment_content.starts_with("local:") {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          "Use `locals:` (plural), not `local:`.",
          node.location.clone(),
        ));
      } else {
        let is_missing_colon = comment_content.strip_prefix("locals").map_or(false, |rest| {
          matches!(rest.chars().next(), Some(character) if character.is_whitespace()) && rest.trim_start().starts_with('(')
        });

        let is_missing_parens = comment_content
          .strip_prefix("locals:")
          .map_or(false, |rest| matches!(rest.trim_start().chars().next(), Some(character) if character != '('));

        let is_empty_locals = comment_content.strip_prefix("locals:").map_or(false, |rest| rest.trim().is_empty());

        if is_missing_colon {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            "Use `locals:` with a colon before the parentheses, not `locals (".to_string() + "`.",
            node.location.clone(),
          ));
        } else if comment_content.starts_with("locals:(") {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            "Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.",
            node.location.clone(),
          ));
        } else if is_missing_parens {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            "Wrap parameters in parentheses: `locals: (name:)` or `locals: (name: default)`.",
            node.location.clone(),
          ));
        } else if is_empty_locals {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            "Add parameters after `locals:`. Use `locals: (name:)` or `locals: ()` for no locals.",
            node.location.clone(),
          ));
        } else {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            "Invalid `locals:` syntax. Use format: `locals: (name:, option: default)`.",
            node.location.clone(),
          ));
        }
      }
    }

    self.walk_erb_content_node(node);
  }
}

impl Rule for ERBStrictLocalsCommentSyntaxRule {
  fn name(&self) -> &'static str {
    "erb-strict-locals-comment-syntax"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for ERBStrictLocalsCommentSyntaxRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = StrictLocalsCommentSyntaxVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      context,
      seen_strict_locals_comment: false,
      first_strict_locals_line: None,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
