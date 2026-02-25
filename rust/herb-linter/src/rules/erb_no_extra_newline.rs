use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, SourceRule};

use herb::Location;
use herb::Position;

define_source_rule!(ERBNoExtraNewlineRule, "erb-no-extra-newline", Error);

fn position_from_offset(source: &str, offset: usize) -> Position {
  let mut line: u32 = 1;
  let mut column: u32 = 0;

  for (index, character) in source.char_indices() {
    if index == offset {
      break;
    }

    if character == '\n' {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }

  Position { line, column }
}

impl SourceRule for ERBNoExtraNewlineRule {
  fn check(&self, source: &str, _context: &LintContext) -> Vec<UnboundOffense> {
    if source.is_empty() {
      return Vec::new();
    }

    let mut offenses = Vec::new();
    let bytes = source.as_bytes();
    let length = bytes.len();
    let mut index = 0;

    while index < length {
      if bytes[index] == b'\n' {
        let start = index;
        let mut count = 0;

        while index < length && bytes[index] == b'\n' {
          count += 1;
          index += 1;
        }

        if count >= 4 {
          let extra_lines = count - 3;
          let start_offset = start + 3;
          let end_offset = start + count;

          let start_position = position_from_offset(source, start_offset);
          let end_position = position_from_offset(source, end_offset);

          let plural = if extra_lines == 1 { "line" } else { "lines" };

          offenses.push(UnboundOffense::new(
            self.name(),
            format!(
              "Extra blank line detected. Remove {} blank {} to maintain consistent spacing (max 2 allowed).",
              extra_lines, plural
            ),
            Location::new(start_position, end_position),
          ));
        }
      } else {
        index += 1;
      }
    }

    offenses
  }
}
