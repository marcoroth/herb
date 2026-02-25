use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, RuleType};
use herb::ParseResult;
use herb_config::Severity;

pub struct ParserNoErrorsRule;

impl Rule for ParserNoErrorsRule {
  fn name(&self) -> &str {
    "parser-no-errors"
  }

  fn rule_type(&self) -> RuleType {
    RuleType::Parser
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn check_parse(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    result
      .recursive_errors()
      .into_iter()
      .map(|error| UnboundOffense {
        rule: self.name().to_string(),
        code: self.name().to_string(),
        message: format!("{} (`{}`)", error.message(), error.error_type()),
        location: error.location().clone(),
      })
      .collect()
  }
}
