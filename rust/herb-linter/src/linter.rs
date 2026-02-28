use std::collections::{HashMap, HashSet};

use crate::herb_disable::parse_herb_disable_line;
use crate::offense::{LintResult, Offense, OffenseLocation, UnboundOffense};
use crate::rule::{AnyRule, LintContext, Rule};
use crate::rules;

use herb_config::{LinterConfig, Severity};

const UNNECESSARY_RULE_NAME: &str = "herb-disable-comment-unnecessary";

pub struct Linter {
  config: LinterConfig,
  rules: Vec<AnyRule>,
}

impl Linter {
  pub fn new(config: LinterConfig) -> Self {
    let rules = rules::all_rules();

    Self { config, rules }
  }

  pub fn default() -> Self {
    Self::new(LinterConfig::new())
  }

  pub fn rule_count(&self) -> usize {
    self.enabled_rules().count()
  }

  pub fn rule_names(&self) -> Vec<&'static str> {
    self.rules.iter().map(|rule| rule.name()).collect()
  }

  pub fn lint(&self, source: &str, context: &LintContext) -> LintResult {
    if self.has_linter_ignore_directive(source) {
      return LintResult::empty();
    }

    let parser_options = herb::ParserOptions {
      track_whitespace: true,
      ..Default::default()
    };

    let parse_result = match herb::parse_with_options(source, &parser_options) {
      Ok(result) => result,
      Err(_) => return LintResult::empty(),
    };

    let has_parse_errors = !parse_result.recursive_errors().is_empty();
    let mut all_offenses: Vec<Offense> = Vec::new();

    if has_parse_errors {
      for rule in self.enabled_rules() {
        if rule.name() == "parser-no-errors" {
          let unbound = rule.check(&parse_result, source, context);
          let severity = self.resolve_severity(rule);
          let bound = self.bind_offenses(unbound, severity);
          all_offenses.extend(bound);
          break;
        }
      }

      return LintResult::new(all_offenses);
    }

    let herb_disable_cache = self.build_herb_disable_cache(source);
    let valid_rule_names: Vec<String> = self.rules.iter().map(|rule| rule.name().to_string()).collect();
    let mut ignored_offenses_by_line: HashMap<u32, HashSet<String>> = HashMap::new();

    let mut ignored_count: usize = 0;
    let mut lint_context = context.clone();

    lint_context.valid_rule_names = valid_rule_names;

    let skipped_rules: HashSet<&str> = if let Some(ref file_name) = context.file_name {
      self
        .enabled_rules()
        .filter(|rule| !self.is_rule_enabled_for_path(rule, file_name))
        .map(|rule| rule.name())
        .collect()
    } else {
      HashSet::new()
    };

    for rule in self.enabled_rules() {
      if rule.name() == UNNECESSARY_RULE_NAME {
        continue;
      }

      if skipped_rules.contains(rule.name()) {
        continue;
      }

      let unbound = rule.check(&parse_result, source, &lint_context);
      let severity = self.resolve_severity(rule);
      let bound = self.bind_offenses(unbound, severity);

      let (kept, ignored) = self.filter_offenses(bound, rule.name(), &herb_disable_cache, &mut ignored_offenses_by_line);

      ignored_count += ignored;
      all_offenses.extend(kept);
    }

    lint_context.ignored_offenses_by_line = ignored_offenses_by_line;

    for rule in self.enabled_rules() {
      if rule.name() != UNNECESSARY_RULE_NAME {
        continue;
      }

      let unbound = rule.check(&parse_result, source, &lint_context);
      let severity = self.resolve_severity(rule);
      let bound = self.bind_offenses(unbound, severity);

      all_offenses.extend(bound);

      break;
    }

    // TODO: implement autofix support using IdentityPrinter from herb-printer
    // to re-print the AST after applying fixes (like the JS linter does)

    LintResult::new_with_ignored(all_offenses, ignored_count)
  }

  fn has_linter_ignore_directive(&self, source: &str) -> bool {
    for line in source.lines() {
      let trimmed = line.trim();

      if !trimmed.contains("herb:linter ignore") {
        continue;
      }

      if let Some(start) = trimmed.find("<%#") {
        if let Some(end) = trimmed[start..].find("%>") {
          let content = trimmed[start + 3..start + end].trim();

          if content == "herb:linter ignore" {
            return true;
          }
        }
      }
    }

    false
  }

  fn build_herb_disable_cache(&self, source: &str) -> HashMap<u32, Vec<String>> {
    let mut cache: HashMap<u32, Vec<String>> = HashMap::new();

    for (i, line) in source.lines().enumerate() {
      if line.contains("herb:disable") {
        let line_number = (i + 1) as u32;

        match parse_herb_disable_line(line) {
          Some(parsed) => {
            cache.insert(line_number, parsed.rule_names);
          }

          None => {
            cache.insert(line_number, Vec::new());
          }
        }
      }
    }

    cache
  }

  fn filter_offenses(
    &self,
    offenses: Vec<Offense>,
    rule_name: &str,
    herb_disable_cache: &HashMap<u32, Vec<String>>,
    ignored_offenses_by_line: &mut HashMap<u32, HashSet<String>>,
  ) -> (Vec<Offense>, usize) {
    if Self::is_non_excludable(rule_name) {
      return (offenses, 0);
    }

    let mut kept = Vec::new();
    let mut ignored_count = 0;

    for offense in offenses {
      let line = offense.location.start.line;
      let disabled_rules = herb_disable_cache.get(&line);

      let is_disabled = match disabled_rules {
        Some(rules) => rules.contains(&rule_name.to_string()) || rules.contains(&"all".to_string()),
        None => false,
      };

      if is_disabled {
        ignored_count += 1;

        let entry = ignored_offenses_by_line.entry(line).or_default();
        if let Some(rules) = disabled_rules {
          if rules.contains(&rule_name.to_string()) {
            entry.insert(rule_name.to_string());
          } else {
            entry.insert("all".to_string());
          }
        }

        continue;
      }

      kept.push(offense);
    }

    (kept, ignored_count)
  }

  fn is_non_excludable(rule_name: &str) -> bool {
    rule_name.starts_with("herb-disable-comment-")
  }

  fn enabled_rules(&self) -> impl Iterator<Item = &AnyRule> {
    self
      .rules
      .iter()
      .filter(|rule| self.config.is_rule_enabled(rule.name(), rule.default_enabled()))
  }

  fn is_rule_enabled_for_path(&self, rule: &AnyRule, file_name: &str) -> bool {
    self.config.is_rule_enabled_for_path(rule.name(), file_name, rule.default_exclude())
  }

  fn resolve_severity(&self, rule: &AnyRule) -> Severity {
    self.config.get_severity(rule.name(), rule.default_severity())
  }

  fn bind_offenses(&self, unbound: Vec<UnboundOffense>, severity: Severity) -> Vec<Offense> {
    unbound
      .into_iter()
      .map(|unbound_offense| Offense {
        rule: unbound_offense.rule,
        code: unbound_offense.code,
        source: "Herb Linter".to_string(),
        message: unbound_offense.message,
        severity,
        location: OffenseLocation::from(&unbound_offense.location),
      })
      .collect()
  }
}
