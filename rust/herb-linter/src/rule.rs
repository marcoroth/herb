use std::collections::{HashMap, HashSet};

use crate::offense::UnboundOffense;

use herb::ParseResult;
use herb_config::Severity;

#[derive(Debug, Clone, Default)]
pub struct LintContext {
  pub file_name: Option<String>,
  pub valid_rule_names: Vec<String>,
  pub ignored_offenses_by_line: HashMap<u32, HashSet<String>>,
}

pub trait Rule: Send + Sync {
  fn name(&self) -> &'static str;
  fn default_severity(&self) -> Severity;

  fn default_enabled(&self) -> bool {
    true
  }

  fn default_exclude(&self) -> &[&str] {
    &[]
  }
}

pub trait ParserRule: Rule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense>;
}

pub trait SourceRule: Rule {
  fn check(&self, source: &str, context: &LintContext) -> Vec<UnboundOffense>;
}

pub enum AnyRule {
  Parser(Box<dyn ParserRule>),
  Source(Box<dyn SourceRule>),
}

impl Rule for AnyRule {
  fn name(&self) -> &'static str {
    match self {
      AnyRule::Parser(rule) => rule.name(),
      AnyRule::Source(rule) => rule.name(),
    }
  }

  fn default_severity(&self) -> Severity {
    match self {
      AnyRule::Parser(rule) => rule.default_severity(),
      AnyRule::Source(rule) => rule.default_severity(),
    }
  }

  fn default_enabled(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.default_enabled(),
      AnyRule::Source(rule) => rule.default_enabled(),
    }
  }

  fn default_exclude(&self) -> &[&str] {
    match self {
      AnyRule::Parser(rule) => rule.default_exclude(),
      AnyRule::Source(rule) => rule.default_exclude(),
    }
  }
}

impl AnyRule {
  pub fn check(&self, parse_result: &ParseResult, source: &str, context: &LintContext) -> Vec<UnboundOffense> {
    match self {
      AnyRule::Parser(rule) => rule.check(parse_result, context),
      AnyRule::Source(rule) => rule.check(source, context),
    }
  }
}
