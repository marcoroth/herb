use std::collections::{HashMap, HashSet};

use crate::autofix::AutofixResult;
use crate::herb_disable::parse_herb_disable_line;
use crate::offense::{LintResult, Offense, OffenseLocation, UnboundOffense};
use crate::rule::{AnyRule, LintContext, Rule};
use crate::rules;
use herb_printer::{IdentityPrinter, IndentPrinter};

use herb::{ParseResult, ParserOptions};
use herb_config::{Config, LinterMode, Severity};

const UNNECESSARY_RULE_NAME: &str = "herb-disable-comment-unnecessary";

struct FilteredOffenses {
  kept: Vec<Offense>,
  ignored: usize,
  would_be_ignored: usize,
}

struct ParseCache<'source> {
  source: &'source str,
  entries: Vec<(ParserOptions, Option<ParseResult>)>,
}

impl<'source> ParseCache<'source> {
  fn new(source: &'source str) -> Self {
    Self { source, entries: Vec::new() }
  }

  fn get(&mut self, options: &ParserOptions) -> Option<&ParseResult> {
    let index = match self.entries.iter().position(|(cached, _)| cached == options) {
      Some(index) => index,

      None => {
        let result = herb::parse_with_options(self.source, options).ok();
        self.entries.push((options.clone(), result));
        self.entries.len() - 1
      }
    };

    self.entries[index].1.as_ref()
  }
}

pub struct Linter {
  config: Config,
  mode: LinterMode,
  rules: Vec<AnyRule>,
}

impl Linter {
  pub fn new(config: Config) -> Self {
    let rules = rules::all_rules();

    Self {
      config,
      mode: LinterMode::Cli,
      rules,
    }
  }

  pub fn default() -> Self {
    Self::new(Config::default())
  }

  pub fn rule_count(&self) -> usize {
    self.enabled_rules().count()
  }

  pub fn rules_disabled_by_config(&self) -> usize {
    self
      .rules
      .iter()
      .filter(|rule| self.config.get_rule_config(rule.name()).is_some() && self.config.is_rule_disabled(rule.name()))
      .count()
  }

  pub fn rules_not_enabled_by_default(&self) -> usize {
    self
      .rules
      .iter()
      .filter(|rule| self.config.get_rule_config(rule.name()).is_none() && !rule.default_enabled())
      .count()
  }

  pub fn is_rule_autocorrectable(&self, rule_name: &str) -> bool {
    self.find_rule(rule_name).map(|rule| rule.autocorrectable()).unwrap_or(false)
  }

  pub fn rule_names(&self) -> Vec<&'static str> {
    self.rules.iter().map(|rule| rule.name()).collect()
  }

  pub fn lint(&self, source: &str, context: &LintContext) -> LintResult {
    if self.has_linter_ignore_directive(source) {
      return LintResult::empty();
    }

    let mut parse_cache = ParseCache::new(source);

    let has_parse_errors = match parse_cache.get(&crate::rule::default_linter_parser_options()) {
      Some(result) => !result.recursive_errors().is_empty(),
      None => return LintResult::empty(),
    };

    let mut all_offenses: Vec<Offense> = Vec::new();

    if has_parse_errors {
      for rule in self.enabled_rules() {
        if rule.name() == "parser-no-errors" {
          let options = rule.parser_options();

          if let Some(parse_result) = parse_cache.get(&options) {
            let unbound = rule.check(parse_result, source, context);
            let severity = self.resolve_severity(rule);
            let bound = self.bind_offenses(unbound, severity);
            all_offenses.extend(bound);
          }

          break;
        }
      }
    }

    let herb_disable_cache = self.build_herb_disable_cache(source);
    let valid_rule_names: Vec<String> = self.rules.iter().map(|rule| rule.name().to_string()).collect();
    let mut ignored_offenses_by_line: HashMap<u32, HashSet<String>> = HashMap::new();

    let mut ignored_count: usize = 0;
    let mut would_be_ignored_count: usize = 0;
    let mut lint_context = context.clone();

    lint_context.valid_rule_names = valid_rule_names;
    lint_context.source = source.to_string();

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
      if rule.name() == UNNECESSARY_RULE_NAME || rule.name() == "parser-no-errors" {
        continue;
      }

      if skipped_rules.contains(rule.name()) {
        continue;
      }

      let options = rule.parser_options();

      let parse_result = match parse_cache.get(&options) {
        Some(result) => result,
        None => continue,
      };

      if rule.is_parser_rule() {
        if !parse_result.recursive_errors().is_empty() && !rule.consumes_parser_errors() {
          continue;
        }
      } else if has_parse_errors {
        continue;
      }

      let unbound = rule.check(parse_result, source, &lint_context);
      let severity = self.resolve_severity(rule);
      let bound = self.bind_offenses(unbound, severity);

      let filtered = self.filter_offenses(
        bound,
        rule.name(),
        &herb_disable_cache,
        &mut ignored_offenses_by_line,
        context.ignore_disable_comments,
      );

      ignored_count += filtered.ignored;
      would_be_ignored_count += filtered.would_be_ignored;
      all_offenses.extend(filtered.kept);
    }

    lint_context.ignored_offenses_by_line = ignored_offenses_by_line;

    for rule in self.enabled_rules() {
      if rule.name() != UNNECESSARY_RULE_NAME {
        continue;
      }

      let options = rule.parser_options();

      if let Some(parse_result) = parse_cache.get(&options) {
        let unbound = rule.check(parse_result, source, &lint_context);
        let severity = self.resolve_severity(rule);
        let bound = self.bind_offenses(unbound, severity);

        all_offenses.extend(bound);
      }

      break;
    }

    // TODO: implement autofix support using IdentityPrinter from herb-printer
    // to re-print the AST after applying fixes (like the JS linter does)

    LintResult::new_with_counts(all_offenses, ignored_count, would_be_ignored_count)
  }

  pub fn autofix(&self, source: &str, context: &LintContext, include_unsafe: bool) -> AutofixResult {
    let offenses = self.lint(source, context).offenses;

    self.autofix_offenses(source, context, offenses, include_unsafe)
  }

  pub fn autofix_offenses(&self, source: &str, context: &LintContext, offenses: Vec<Offense>, include_unsafe: bool) -> AutofixResult {
    let mut parser_offenses: Vec<Offense> = Vec::new();
    let mut source_offenses: Vec<Offense> = Vec::new();

    for offense in offenses {
      match self.find_rule(&offense.rule) {
        Some(rule) if rule.is_parser_rule() => parser_offenses.push(offense),
        Some(_) => source_offenses.push(offense),
        None => {}
      }
    }

    let mut current_source = source.to_string();
    let mut fixed: Vec<Offense> = Vec::new();
    let mut unfixed: Vec<Offense> = Vec::new();

    let mut context = context.clone();
    context.source = current_source.clone();
    let context = &context;

    if !parser_offenses.is_empty() {
      let options = crate::rule::default_linter_parser_options();

      match herb::parse_with_options(&current_source, &options) {
        Ok(mut parse_result) => {
          let mut any_fixed = false;
          let mut needs_reindent = false;

          for offense in parser_offenses {
            let rule = match self.find_rule(&offense.rule) {
              Some(rule) => rule,
              None => {
                unfixed.push(offense);
                continue;
              }
            };

            let is_unsafe = rule.unsafe_autocorrectable() || offense.unsafe_fix;

            if !rule.has_autofix() || !offense.autofixable || (is_unsafe && !include_unsafe) {
              unfixed.push(offense);
              continue;
            }

            if rule.autofix(&offense, &mut parse_result.value, context) {
              if rule.reindent_after_autofix() {
                needs_reindent = true;
              }

              any_fixed = true;
              fixed.push(offense);
            } else {
              unfixed.push(offense);
            }
          }

          if any_fixed {
            current_source = if needs_reindent {
              IndentPrinter::print_with_width(&parse_result.value, context.indent_width.unwrap_or(2))
            } else {
              IdentityPrinter::print_document(&parse_result.value)
            };
          }
        }

        Err(_) => unfixed.extend(parser_offenses),
      }
    }

    if !source_offenses.is_empty() {
      source_offenses.sort_by(|a, b| {
        b.location
          .start
          .line
          .cmp(&a.location.start.line)
          .then_with(|| b.location.start.column.cmp(&a.location.start.column))
      });

      for offense in source_offenses {
        let rule = match self.find_rule(&offense.rule) {
          Some(rule) => rule,
          None => {
            unfixed.push(offense);
            continue;
          }
        };

        let is_unsafe = rule.unsafe_autocorrectable() || offense.unsafe_fix;

        if !rule.has_autofix() || !offense.autofixable || (is_unsafe && !include_unsafe) {
          unfixed.push(offense);
          continue;
        }

        match rule.autofix_source(&offense, &current_source, context) {
          Some(corrected) => {
            current_source = corrected;
            fixed.push(offense);
          }

          None => unfixed.push(offense),
        }
      }
    }

    AutofixResult {
      source: current_source,
      fixed,
      unfixed,
    }
  }

  fn find_rule(&self, rule_name: &str) -> Option<&AnyRule> {
    self.rules.iter().find(|rule| rule.name() == rule_name)
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
    ignore_disable_comments: bool,
  ) -> FilteredOffenses {
    if Self::is_non_excludable(rule_name) {
      return FilteredOffenses {
        kept: offenses,
        ignored: 0,
        would_be_ignored: 0,
      };
    }

    if ignore_disable_comments {
      let would_be_ignored = offenses
        .iter()
        .filter(|offense| Self::is_disabled_on_line(rule_name, offense.location.start.line, herb_disable_cache))
        .count();

      return FilteredOffenses {
        kept: offenses,
        ignored: 0,
        would_be_ignored,
      };
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

    FilteredOffenses {
      kept,
      ignored: ignored_count,
      would_be_ignored: 0,
    }
  }

  fn is_disabled_on_line(rule_name: &str, line: u32, herb_disable_cache: &HashMap<u32, Vec<String>>) -> bool {
    match herb_disable_cache.get(&line) {
      Some(rules) => rules.iter().any(|rule| rule == rule_name || rule == "all"),
      None => false,
    }
  }

  fn is_non_excludable(rule_name: &str) -> bool {
    rule_name.starts_with("herb-disable-comment-")
  }

  fn enabled_rules(&self) -> impl Iterator<Item = &AnyRule> {
    self.rules.iter().filter(|rule| self.filter_rule_by_config(rule))
  }

  fn filter_rule_by_config(&self, rule: &AnyRule) -> bool {
    match self.config.get_rule_config(rule.name()) {
      Some(_) => !self.config.is_rule_disabled(rule.name()),
      None => rule.default_enabled(),
    }
  }

  fn is_rule_enabled_for_path(&self, rule: &AnyRule, file_name: &str) -> bool {
    if !self.config.is_rule_enabled_for_path(rule.name(), file_name) {
      return false;
    }

    if !self.config.has_rule_exclude(rule.name()) {
      let default_exclude = rule.default_exclude();

      if !default_exclude.is_empty() && herb_config::is_path_matching(file_name, default_exclude) {
        return false;
      }
    }

    true
  }

  fn resolve_severity(&self, rule: &AnyRule) -> Severity {
    self.config.get_configured_severity(rule.name(), rule.default_severity(), self.mode)
  }

  fn bind_offenses(&self, unbound: Vec<UnboundOffense>, severity: Severity) -> Vec<Offense> {
    unbound
      .into_iter()
      .map(|unbound_offense| Offense {
        rule: unbound_offense.rule,
        code: unbound_offense.code,
        source: "Herb Linter".to_string(),
        message: unbound_offense.message,
        severity: unbound_offense.severity.unwrap_or(severity),
        location: OffenseLocation::from(&unbound_offense.location),
        tags: unbound_offense.tags,
        unsafe_fix: unbound_offense.unsafe_fix,
        autofixable: unbound_offense.autofixable,
      })
      .collect()
  }
}
