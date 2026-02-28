use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::ParseResult;
use herb_config::Severity;

pub struct ParserNoErrorsRule;

impl Rule for ParserNoErrorsRule {
  fn name(&self) -> &'static str {
    "parser-no-errors"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for ParserNoErrorsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    result
      .recursive_errors()
      .into_iter()
      .map(|error| UnboundOffense::new(self.name(), format!("{} (`{}`)", error.message(), error.error_type()), error.location().clone()))
      .collect()
  }
}
