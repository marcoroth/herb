use crate::offense::UnboundOffense;
use herb::ParseResult;
use herb_config::Severity;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuleType {
  Parser,
  Source,
}

#[derive(Debug, Clone, Default)]
pub struct LintContext {
  pub file_name: Option<String>,
}

pub trait Rule: Send + Sync {
  fn name(&self) -> &str;
  fn rule_type(&self) -> RuleType;
  fn default_severity(&self) -> Severity;

  fn default_enabled(&self) -> bool {
    true
  }

  fn default_exclude(&self) -> &[&str] {
    &[]
  }

  fn check_parse(&self, _result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    Vec::new()
  }

  fn check_source(&self, _source: &str, _context: &LintContext) -> Vec<UnboundOffense> {
    Vec::new()
  }
}
