use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::*;
use herb::union_types::*;
use herb::Location;
use herb::ParseResult;
use herb::Visitor;

use herb_config::Severity;

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
        HTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(tag) => {
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
  fn name(&self) -> &'static str {
    "erb-no-trailing-whitespace"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for ERBNoTrailingWhitespaceRule {
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
