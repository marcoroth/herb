use herb_config::{Config, HerbConfigOptions};
use herb_linter::linter::Linter;
use herb_linter::rule::LintContext;

fn linter_with_version(version: Option<&str>) -> Linter {
  let config = Config::from_object(&HerbConfigOptions::default(), std::path::Path::new("/project"), None, version.map(String::from)).unwrap();

  Linter::new(config)
}

#[test]
fn rules_introduced_after_the_pinned_version_are_skipped() {
  let source = "<div>\n  <%= yield %>\n</div>\n";

  let old = linter_with_version(Some("0.4.0"));
  let current = linter_with_version(Some("0.10.2"));

  let old_rules = old.rule_count();
  let current_rules = current.rule_count();

  assert!(
    old_rules < current_rules,
    "pinning an older version should enable fewer rules (old={old_rules}, current={current_rules})"
  );

  let _ = old.lint(source, &LintContext::default());
}

#[test]
fn no_config_version_enables_every_default_rule() {
  let pinned = linter_with_version(Some("0.4.0"));
  let unpinned = linter_with_version(None);

  assert!(pinned.rule_count() < unpinned.rule_count());
}

#[test]
fn a_version_at_or_above_the_rule_keeps_it_enabled() {
  let exact = linter_with_version(Some("0.10.2"));
  let unpinned = linter_with_version(None);

  assert_eq!(exact.rule_count(), unpinned.rule_count());
}
