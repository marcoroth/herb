use crate::offense::Offense;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use herb::nodes::{AnyNode, DocumentNode};

use herb::nodes::*;
use herb::union_types::*;
use herb::Location;
use herb::ParseResult;
use herb::Visitor;

use herb_config::{Severity, SeverityConfig};

pub struct ERBNoTrailingWhitespaceRule;

struct SkipZone {
  start_line: u32,
  start_column: u32,
  end_line: u32,
  end_column: u32,
}

struct TrailingWhitespaceCandidate {
  line: u32,
  column: u32,
  length: u32,
}

struct SkipZoneCollector {
  skip_zones: Vec<SkipZone>,
}

impl SkipZoneCollector {
  fn is_skip_tag(tag_name: &str) -> bool {
    matches!(tag_name.to_lowercase().as_str(), "pre" | "textarea" | "script" | "style")
  }
}

impl Visitor for SkipZoneCollector {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(ref open_tag) = node.open_tag {
      match open_tag {
        ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(tag) => {
          if let Some(ref tag_name) = tag.tag_name {
            if Self::is_skip_tag(&tag_name.value) {
              self.skip_zones.push(SkipZone {
                start_line: node.location.start.line,
                start_column: node.location.start.column,
                end_line: node.location.end.line,
                end_column: node.location.end.column,
              });

              return;
            }
          }
        }
        _ => {}
      }
    }

    self.walk_html_element_node(node);
  }

  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    if let (Some(tag_opening), Some(tag_closing)) = (node.tag_opening(), node.tag_closing()) {
      self.skip_zones.push(SkipZone {
        start_line: tag_opening.location.start.line,
        start_column: tag_opening.location.start.column,
        end_line: tag_closing.location.end.line,
        end_column: tag_closing.location.end.column,
      });
    }
  }
}

fn find_trailing_whitespace_candidates(lines: &[&str]) -> Vec<TrailingWhitespaceCandidate> {
  let mut candidates = Vec::new();

  for (index, line) in lines.iter().enumerate() {
    let trimmed_length = line
      .trim_end_matches(|character: char| {
        character == ' ' || character == '\t' || character == '\r' || character == '\x0B' || character == '\x0C' || character == '\u{00A0}'
      })
      .len();

    if trimmed_length < line.len() {
      candidates.push(TrailingWhitespaceCandidate {
        line: (index + 1) as u32,
        column: trimmed_length as u32,
        length: (line.len() - trimmed_length) as u32,
      });
    }
  }

  candidates
}

fn is_in_skip_zone(candidate: &TrailingWhitespaceCandidate, skip_zones: &[SkipZone]) -> bool {
  for zone in skip_zones {
    if candidate.line < zone.start_line || candidate.line > zone.end_line {
      continue;
    }

    if candidate.line == zone.end_line && candidate.column >= zone.end_column {
      continue;
    }

    if candidate.line == zone.start_line && candidate.column < zone.start_column {
      continue;
    }

    return true;
  }

  false
}

impl Rule for ERBNoTrailingWhitespaceRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "erb-no-trailing-whitespace"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.0")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }
}

impl ParserRule for ERBNoTrailingWhitespaceRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, context: &LintContext) -> bool {
    autofix(offense, document, context)
  }

  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let lines: Vec<&str> = result.source.split('\n').collect();
    let candidates = find_trailing_whitespace_candidates(&lines);

    if candidates.is_empty() {
      return Vec::new();
    }

    let mut offenses = Vec::new();
    let mut collector = SkipZoneCollector { skip_zones: Vec::new() };

    collector.visit_document_node(&result.value);

    for candidate in &candidates {
      if !is_in_skip_zone(candidate, &collector.skip_zones) {
        let location = Location::from(candidate.line, candidate.column, candidate.line, candidate.column + candidate.length);

        offenses.push(UnboundOffense::new(self.name(), "Extra whitespace detected at end of line.", location));
      }
    }

    offenses
  }
}

const TRAILING: &[char] = &[' ', '\t', '\r', '\u{b}', '\u{c}', '\u{a0}'];

/// Drops horizontal whitespace that sits immediately before a newline.
fn strip_before_newlines(content: &str) -> String {
  content
    .split('\n')
    .collect::<Vec<_>>()
    .iter()
    .enumerate()
    .map(|(index, line)| {
      if index + 1 == content.split('\n').count() {
        line.to_string()
      } else {
        line.trim_end_matches(TRAILING).to_string()
      }
    })
    .collect::<Vec<_>>()
    .join("\n")
}

fn has_trailing_whitespace_not_indentation(content: &str) -> bool {
  if content.ends_with('\n') {
    return false;
  }

  let trimmed = content.trim_end_matches(TRAILING);

  if trimmed.len() == content.len() || trimmed.is_empty() {
    return false;
  }

  !trimmed.ends_with('\n')
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  crate::autofix::walk_nodes_mut(&mut document.children, &mut |node| {
    let (content, location) = match node {
      AnyNode::HTMLTextNode(text) => (&mut text.content, &text.location),
      AnyNode::LiteralNode(literal) => (&mut literal.content, &literal.location),
      _ => return,
    };

    let within = offense.location.start.line >= location.start.line && offense.location.end.line <= location.end.line;

    if !within {
      return;
    }

    let at_end_of_content = offense.location.end.line == location.end.line && offense.location.end.column == location.end.column;

    let starts_at_column_zero = location.start.column == 0;
    let mut updated = strip_before_newlines(content);

    if at_end_of_content {
      if has_trailing_whitespace_not_indentation(&updated) {
        updated = updated.trim_end_matches(TRAILING).to_string();
      }

      if !updated.is_empty() && updated.chars().all(|character| TRAILING.contains(&character)) && !starts_at_column_zero {
        updated = String::new();
      }
    }

    *content = updated;

    // the JavaScript rule reports the offense as fixed whenever it owns the node,
    // even when an earlier offense already cleaned the content
    fixed = true;
  });

  fixed
}
