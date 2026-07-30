use std::collections::{HashMap, HashSet};

use crate::offense::{Offense, UnboundOffense};

use herb::nodes::DocumentNode;
use herb::{ParseResult, ParserOptions};
use herb_config::SeverityConfig;

pub fn default_linter_parser_options() -> ParserOptions {
  ParserOptions {
    track_whitespace: true,
    ..Default::default()
  }
}

#[derive(Debug, Clone, Default)]
pub struct LintContext {
  pub file_name: Option<String>,
  pub valid_rule_names: Vec<String>,
  pub ignored_offenses_by_line: HashMap<u32, HashSet<String>>,
  pub ignore_disable_comments: bool,
  pub source: String,
  pub indent_width: Option<usize>,
}

pub trait Rule: Send + Sync {
  fn name(&self) -> &'static str;
  fn default_severity(&self) -> SeverityConfig;

  fn default_enabled(&self) -> bool {
    true
  }

  fn default_exclude(&self) -> &[&str] {
    &[]
  }

  fn parser_options(&self) -> ParserOptions {
    default_linter_parser_options()
  }

  fn consumes_parser_errors(&self) -> bool {
    false
  }

  fn has_autofix(&self) -> bool {
    false
  }

  fn autocorrectable(&self) -> bool {
    false
  }

  fn unsafe_autocorrectable(&self) -> bool {
    false
  }

  fn reindent_after_autofix(&self) -> bool {
    false
  }
}

pub trait ParserRule: Rule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense>;

  fn autofix(&self, _offense: &Offense, _document: &mut DocumentNode, _context: &LintContext) -> bool {
    false
  }
}

pub trait SourceRule: Rule {
  fn check(&self, source: &str, context: &LintContext) -> Vec<UnboundOffense>;

  fn autofix(&self, _offense: &Offense, _source: &str, _context: &LintContext) -> Option<String> {
    None
  }
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

  fn default_severity(&self) -> SeverityConfig {
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

  fn parser_options(&self) -> ParserOptions {
    match self {
      AnyRule::Parser(rule) => rule.parser_options(),
      AnyRule::Source(rule) => rule.parser_options(),
    }
  }

  fn consumes_parser_errors(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.consumes_parser_errors(),
      AnyRule::Source(rule) => rule.consumes_parser_errors(),
    }
  }

  fn has_autofix(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.has_autofix(),
      AnyRule::Source(rule) => rule.has_autofix(),
    }
  }

  fn autocorrectable(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.autocorrectable(),
      AnyRule::Source(rule) => rule.autocorrectable(),
    }
  }

  fn unsafe_autocorrectable(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.unsafe_autocorrectable(),
      AnyRule::Source(rule) => rule.unsafe_autocorrectable(),
    }
  }

  fn reindent_after_autofix(&self) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.reindent_after_autofix(),
      AnyRule::Source(rule) => rule.reindent_after_autofix(),
    }
  }
}

impl AnyRule {
  pub fn is_parser_rule(&self) -> bool {
    matches!(self, AnyRule::Parser(_))
  }

  pub fn autofix(&self, offense: &Offense, document: &mut DocumentNode, context: &LintContext) -> bool {
    match self {
      AnyRule::Parser(rule) => rule.autofix(offense, document, context),
      AnyRule::Source(_) => false,
    }
  }

  pub fn autofix_source(&self, offense: &Offense, source: &str, context: &LintContext) -> Option<String> {
    match self {
      AnyRule::Parser(_) => None,
      AnyRule::Source(rule) => rule.autofix(offense, source, context),
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
