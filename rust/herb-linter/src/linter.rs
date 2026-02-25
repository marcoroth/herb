use crate::offense::{LintResult, Offense, OffenseLocation, UnboundOffense};
use crate::rule::{LintContext, Rule, RuleType};
use crate::rules;
use herb_config::{LinterConfig, Severity};

pub struct Linter {
  config: LinterConfig,
  rules: Vec<Box<dyn Rule>>,
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

  pub fn rule_names(&self) -> Vec<&str> {
    self.rules.iter().map(|rule| rule.name()).collect()
  }

  pub fn lint(&self, source: &str, context: &LintContext) -> LintResult {
    let parse_result = match herb::parse(source) {
      Ok(result) => result,
      Err(_) => return LintResult::empty(),
    };

    let has_parse_errors = !parse_result.recursive_errors().is_empty();
    let mut all_offenses: Vec<Offense> = Vec::new();

    for rule in self.enabled_rules() {
      // If there are parse errors, only run the parser-no-errors rule
      if has_parse_errors && rule.name() != "parser-no-errors" {
        continue;
      }

      let unbound = match rule.rule_type() {
        RuleType::Parser => rule.check_parse(&parse_result, context),
        RuleType::Source => rule.check_source(source, context),
      };

      let severity = self.resolve_severity(rule.as_ref());
      let bound = self.bind_offenses(unbound, severity);
      all_offenses.extend(bound);

      // If parse errors, return early after parser-no-errors
      if has_parse_errors {
        return LintResult::new(all_offenses);
      }
    }

    LintResult::new(all_offenses)
  }

  fn enabled_rules(&self) -> impl Iterator<Item = &Box<dyn Rule>> {
    self.rules.iter().filter(|rule| {
      self
        .config
        .is_rule_enabled(rule.name(), rule.default_enabled())
    })
  }

  fn resolve_severity(&self, rule: &dyn Rule) -> Severity {
    self
      .config
      .get_severity(rule.name(), rule.default_severity())
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
