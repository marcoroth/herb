use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, RuleType};
use herb::Location;
use herb::Position;
use herb_config::Severity;

pub struct ERBRequireTrailingNewlineRule;

fn create_end_of_file_location(source: &str) -> Location {
  let lines: Vec<&str> = source.split('\n').collect();
  let last_line_number = lines.len() as u32;
  let last_line = lines.last().unwrap_or(&"");
  let last_column = last_line.len() as u32;
  let start_column = if last_column > 0 { last_column - 1 } else { 0 };

  Location {
    start: Position {
      line: last_line_number,
      column: start_column,
    },
    end: Position {
      line: last_line_number,
      column: last_column,
    },
  }
}

impl Rule for ERBRequireTrailingNewlineRule {
  fn name(&self) -> &str {
    "erb-require-trailing-newline"
  }

  fn rule_type(&self) -> RuleType {
    RuleType::Source
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn check_source(&self, source: &str, context: &LintContext) -> Vec<UnboundOffense> {
    if source.is_empty() {
      return Vec::new();
    }

    if context.file_name.is_none() {
      return Vec::new();
    }

    if !source.ends_with('\n') {
      return vec![UnboundOffense {
        rule: self.name().to_string(),
        code: self.name().to_string(),
        message: "File must end with trailing newline.".to_string(),
        location: create_end_of_file_location(source),
      }];
    }

    if source.ends_with("\n\n") {
      return vec![UnboundOffense {
        rule: self.name().to_string(),
        code: self.name().to_string(),
        message: "File must end with exactly one trailing newline.".to_string(),
        location: create_end_of_file_location(source),
      }];
    }

    Vec::new()
  }
}
