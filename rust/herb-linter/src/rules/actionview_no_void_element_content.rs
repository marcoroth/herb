use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::ParseResult;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewNoVoidElementContentRule;

impl Rule for ActionViewNoVoidElementContentRule {
  fn name(&self) -> &'static str {
    "actionview-no-void-element-content"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn consumes_parser_errors(&self) -> bool {
    true
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ActionViewNoVoidElementContentRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    result
      .recursive_errors()
      .into_iter()
      .filter(|error| error.error_type() == "VOID_ELEMENT_CONTENT_ERROR")
      .map(|error| UnboundOffense::new(self.name(), error.message(), error.location().clone()))
      .collect()
  }
}
