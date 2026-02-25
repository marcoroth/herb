use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, SourceRule};

use herb::Location;

define_source_rule!(ERBRequireTrailingNewlineRule, "erb-require-trailing-newline", Error);

fn create_end_of_file_location(source: &str) -> Location {
  let lines: Vec<&str> = source.split('\n').collect();
  let last_line_number = lines.len() as u32;
  let last_line = lines.last().unwrap_or(&"");
  let last_column = last_line.len() as u32;
  let start_column = if last_column > 0 { last_column - 1 } else { 0 };

  Location::from(last_line_number, start_column, last_line_number, last_column)
}

impl SourceRule for ERBRequireTrailingNewlineRule {
  fn check(&self, source: &str, context: &LintContext) -> Vec<UnboundOffense> {
    if source.is_empty() {
      return Vec::new();
    }

    if context.file_name.is_none() {
      return Vec::new();
    }

    if !source.ends_with('\n') {
      return vec![UnboundOffense::new(
        self.name(),
        "File must end with trailing newline.",
        create_end_of_file_location(source),
      )];
    }

    if source.ends_with("\n\n") {
      return vec![UnboundOffense::new(
        self.name(),
        "File must end with exactly one trailing newline.",
        create_end_of_file_location(source),
      )];
    }

    Vec::new()
  }
}
