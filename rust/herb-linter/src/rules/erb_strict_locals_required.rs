use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, SourceRule};
use crate::utils::file_utils::is_partial_file;

use herb::Location;

define_source_rule!(ERBStrictLocalsRequiredRule, "erb-strict-locals-required", Error, enabled: false);

fn has_strict_locals(source: &str) -> bool {
  source.contains("<%# locals:") || source.contains("<%#locals:")
}

impl SourceRule for ERBStrictLocalsRequiredRule {
  fn check(&self, source: &str, context: &LintContext) -> Vec<UnboundOffense> {
    let file_name = match &context.file_name {
      Some(name) => name,
      None => return Vec::new(),
    };

    if !is_partial_file(file_name) {
      return Vec::new();
    }

    if has_strict_locals(source) {
      return Vec::new();
    }

    let first_line_length = source.find('\n').unwrap_or(source.len()) as u32;

    vec![UnboundOffense::new(
      self.name(),
      "Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.",
      Location::from(1, 0, 1, first_line_length),
    )]
  }
}
