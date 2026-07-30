use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, Rule, SourceRule};

use herb::{Location, Position};

define_source_rule!(SourceIndentationRule, "source-indentation", Error, has_autofix: true, autocorrectable: true,
  introduced_in: "0.9.3"
);

fn tab_indentation_length(line: &str) -> Option<usize> {
  let mut length = 0;
  let mut has_tab = false;

  for character in line.chars() {
    if character == '\n' || !character.is_whitespace() {
      break;
    }

    if character == '\t' {
      has_tab = true;
    }

    length += character.len_utf8();
  }

  if has_tab {
    Some(length)
  } else {
    None
  }
}

impl SourceRule for SourceIndentationRule {
  fn check(&self, source: &str, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut offenses = Vec::new();
    let mut line_number: u32 = 1;

    for line in source.split('\n') {
      if let Some(length) = tab_indentation_length(line) {
        offenses.push(UnboundOffense::new(
          <Self as Rule>::name(self),
          "Indent with spaces instead of tabs.",
          Location::new(Position::new(line_number, 0), Position::new(line_number, length as u32)),
        ));
      }

      line_number += 1;
    }

    offenses
  }
  fn autofix(&self, _offense: &Offense, source: &str, context: &LintContext) -> Option<String> {
    let indent_width = context.indent_width.unwrap_or(2);
    let indent = " ".repeat(indent_width);

    let fixed: Vec<String> = source
      .split('\n')
      .map(|line| match tab_indentation_length(line) {
        Some(length) => format!("{}{}", line[..length].replace('\t', &indent), &line[length..]),
        None => line.to_string(),
      })
      .collect();

    Some(fixed.join("\n"))
  }
}
