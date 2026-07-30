use crate::offense::Offense;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::html_character_references::is_valid_character_reference;
use crate::utils::tag_utils::get_tag_local_name;
use herb::nodes::{AnyNode, DocumentNode};

use herb::nodes::{HTMLElementNode, HTMLTextNode};
use herb::{Location, ParseResult, Position, Visitor};
use herb_config::{Severity, SeverityConfig};

const RAW_TEXT_ELEMENTS: &[&str] = &["script", "style"];

pub struct HTMLNoUnescapedEntitiesRule;

struct HTMLNoUnescapedEntitiesVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

struct UnescapedOccurrence {
  character: char,
  entity: &'static str,
  offset: usize,
}

fn find_all_indexes(value: &str, character: char) -> Vec<usize> {
  value.char_indices().filter(|(_, found)| *found == character).map(|(index, _)| index).collect()
}

fn ampersand_spans(value: &str) -> Vec<(usize, usize)> {
  let bytes = value.as_bytes();
  let mut spans = Vec::new();
  let mut index = 0;

  while index < bytes.len() {
    if bytes[index] != b'&' {
      index += 1;
      continue;
    }

    let mut end = index + 1;

    if end < bytes.len() && bytes[end] == b'#' {
      end += 1;

      if end < bytes.len() && (bytes[end] == b'x' || bytes[end] == b'X') {
        let digits_start = end + 1;
        let mut digits_end = digits_start;

        while digits_end < bytes.len() && bytes[digits_end].is_ascii_hexdigit() {
          digits_end += 1;
        }

        end = if digits_end > digits_start { digits_end } else { index + 1 };
      } else {
        let digits_start = end;
        let mut digits_end = digits_start;

        while digits_end < bytes.len() && bytes[digits_end].is_ascii_digit() {
          digits_end += 1;
        }

        end = if digits_end > digits_start { digits_end } else { index + 1 };
      }
    } else if end < bytes.len() && bytes[end].is_ascii_alphabetic() {
      while end < bytes.len() && bytes[end].is_ascii_alphanumeric() {
        end += 1;
      }
    }

    if end < bytes.len() && bytes[end] == b';' {
      end += 1;
    }

    spans.push((index, end));

    index = end.max(index + 1);
  }

  spans
}

fn find_bare_ampersand_indexes(value: &str) -> Vec<usize> {
  ampersand_spans(value)
    .into_iter()
    .filter(|(start, end)| !is_valid_character_reference(&value[*start..*end]))
    .map(|(start, _)| start)
    .collect()
}

fn find_unescaped_occurrences(value: &str) -> Vec<UnescapedOccurrence> {
  let mut occurrences = Vec::new();

  for offset in find_all_indexes(value, '<') {
    occurrences.push(UnescapedOccurrence {
      character: '<',
      entity: "&lt;",
      offset,
    });
  }

  for offset in find_all_indexes(value, '>') {
    occurrences.push(UnescapedOccurrence {
      character: '>',
      entity: "&gt;",
      offset,
    });
  }

  for offset in find_bare_ampersand_indexes(value) {
    occurrences.push(UnescapedOccurrence {
      character: '&',
      entity: "&amp;",
      offset,
    });
  }

  occurrences
}

fn location_from_content_offset(start_line: u32, start_column: u32, content: &str, offset: usize) -> Location {
  let mut line = start_line;
  let mut column = start_column;

  for character in content[..offset].chars() {
    if character == '\n' {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }

  Location::new(Position::new(line, column), Position::new(line, column + 1))
}

impl Visitor for HTMLNoUnescapedEntitiesVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let tag_name = get_tag_local_name(node);
    let pushed = tag_name.is_some();

    if let Some(tag_name) = tag_name {
      self.element_stack.push(tag_name);
    }

    self.walk_html_element_node(node);

    if pushed {
      self.element_stack.pop();
    }
  }

  fn visit_html_text_node(&mut self, node: &HTMLTextNode) {
    if self.element_stack.inside_any(RAW_TEXT_ELEMENTS) {
      self.walk_html_text_node(node);
      return;
    }

    if node.content.is_empty() {
      return;
    }

    for occurrence in find_unescaped_occurrences(&node.content) {
      let location = location_from_content_offset(node.location.start.line, node.location.start.column, &node.content, occurrence.offset);

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "Text content contains an unescaped `{}` character. Use `{}` instead.",
          occurrence.character, occurrence.entity
        ),
        location,
      ));
    }

    self.walk_html_text_node(node);
  }
}

impl Rule for HTMLNoUnescapedEntitiesRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn unsafe_autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "html-no-unescaped-entities"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Warning)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for HTMLNoUnescapedEntitiesRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let mut fixed = false;

    crate::autofix::walk_nodes_mut(&mut document.children, &mut |node| {
      let text = match node {
        AnyNode::HTMLTextNode(text) => text,
        _ => return,
      };

      let contains_offense = offense.location.start.line >= text.location.start.line && offense.location.end.line <= text.location.end.line;

      if !contains_offense {
        return;
      }

      let escaped = escape_bare_ampersands(&text.content).replace('<', "&lt;").replace('>', "&gt;");

      if escaped != text.content {
        text.content = escaped;
        fixed = true;
      }
    });

    fixed
  }

  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = HTMLNoUnescapedEntitiesVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}

fn escape_bare_ampersands(content: &str) -> String {
  let mut result = String::with_capacity(content.len());
  let mut last = 0;

  for (start, end) in ampersand_spans(content) {
    result.push_str(&content[last..start]);

    if is_valid_character_reference(&content[start..end]) {
      result.push_str(&content[start..end]);
    } else {
      result.push_str("&amp;");
      result.push_str(&content[start + 1..end]);
    }

    last = end;
  }

  result.push_str(&content[last..]);

  result
}
