use std::fs;
use std::path::{Path, PathBuf};

use herb_config::{Config, HerbConfig, HerbConfigOptions, LinterMode, Severity, SeverityConfig, SeverityOverridable, Tool};

fn default_include_patterns() -> Vec<String> {
  Config::get_default_file_patterns()
}

fn default_exclude_patterns() -> Vec<String> {
  Config::get_default_config(herb_config::DEFAULT_VERSION)
    .files
    .and_then(|files| files.exclude)
    .unwrap_or_default()
}

fn with_defaults(patterns: Vec<String>, additional: &[&str]) -> Vec<String> {
  let mut expected = patterns;

  expected.extend(additional.iter().map(|pattern| (*pattern).to_string()));

  expected
}

fn include_with(additional: &[&str]) -> Vec<String> {
  with_defaults(default_include_patterns(), additional)
}

fn exclude_with(additional: &[&str]) -> Vec<String> {
  with_defaults(default_exclude_patterns(), additional)
}

fn config_from_yaml(yaml: &str) -> Config {
  let options: HerbConfigOptions = serde_yaml::from_str(yaml).unwrap();

  Config::from_object(&options, Path::new("/project"), None, None).unwrap()
}

fn config_from_yaml_in(yaml: &str, project_path: &Path) -> Config {
  let options: HerbConfigOptions = serde_yaml::from_str(yaml).unwrap();

  Config::from_object(&options, project_path, None, None).unwrap()
}

fn create_test_file(project_path: &Path, relative_path: &str) -> String {
  let file_path = project_path.join(relative_path);

  fs::create_dir_all(file_path.parent().unwrap()).unwrap();
  fs::write(&file_path, "").unwrap();

  file_path.to_string_lossy().into_owned()
}

fn sorted(mut files: Vec<String>) -> Vec<String> {
  files.sort();

  files
}

struct Offense {
  rule: String,
  severity: Severity,
}

impl SeverityOverridable for Offense {
  fn rule(&self) -> &str {
    &self.rule
  }

  fn set_severity(&mut self, severity: Severity) {
    self.severity = severity;
  }
}

fn offense(rule: &str, severity: Severity) -> Offense {
  Offense {
    rule: rule.to_string(),
    severity,
  }
}

mod config_class {
  use super::*;

  #[test]
  fn is_defined() {
    assert!(!Config::default().version().is_empty());
  }

  #[test]
  fn can_be_instantiated() {
    let config = Config::new(Path::new("/project"), HerbConfig::default(), None);

    assert_eq!(config.project_path(), Path::new("/project"));
  }

  #[test]
  fn sets_correct_config_path() {
    let config = Config::new(Path::new("/project"), HerbConfig::default(), None);

    assert_eq!(config.path, PathBuf::from("/project/.herb.yml"));
  }
}

mod config_path_from_project_path {
  use super::*;

  #[test]
  fn returns_correct_path_for_project_directory() {
    assert_eq!(
      Config::config_path_from_project_path(Path::new("/project")),
      PathBuf::from("/project/.herb.yml")
    );
  }

  #[test]
  fn appends_herb_yml_to_any_path_including_an_explicit_herb_yml() {
    assert_eq!(
      Config::config_path_from_project_path(Path::new("/project/.herb.yml")),
      PathBuf::from("/project/.herb.yml/.herb.yml")
    );
  }
}

mod config_exists {
  use super::*;

  #[test]
  fn returns_false_when_config_file_does_not_exist() {
    let dir = tempfile::tempdir().unwrap();

    assert!(!Config::exists(dir.path()));
  }

  #[test]
  fn returns_true_when_config_file_exists() {
    let dir = tempfile::tempdir().unwrap();

    fs::write(dir.path().join(".herb.yml"), "version: 0.10.3\n").unwrap();

    assert!(Config::exists(dir.path()));
  }

  #[test]
  fn handles_explicit_herb_yml_path() {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join(".herb.yml");

    fs::write(&config_path, "version: 0.10.3\n").unwrap();

    assert!(Config::exists(&config_path));
  }
}

mod config_read_raw_yaml {
  use super::*;

  #[test]
  fn reads_raw_yaml_content_from_config_file() {
    let dir = tempfile::tempdir().unwrap();

    fs::write(dir.path().join(".herb.yml"), "version: 0.10.3\n# a comment\n").unwrap();

    assert!(Config::read_raw_yaml(dir.path()).unwrap().contains("# a comment"));
  }

  #[test]
  fn handles_explicit_herb_yml_path() {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join(".herb.yml");

    fs::write(&config_path, "version: 0.10.3\n# a comment\n").unwrap();

    assert!(Config::read_raw_yaml(&config_path).unwrap().contains("# a comment"));
  }
}

mod config_from_object {
  use super::*;

  #[test]
  fn creates_config_from_empty_object() {
    let config = Config::from_object(&HerbConfigOptions::default(), Path::new("/project"), None, None).unwrap();

    assert!(config.is_linter_enabled());
    assert!(!config.is_formatter_enabled());
  }

  #[test]
  fn creates_config_with_linter_settings() {
    let config = config_from_yaml("linter:\n  enabled: false\n");

    assert!(!config.is_linter_enabled());
  }

  #[test]
  fn creates_config_with_formatter_settings() {
    let config = config_from_yaml("formatter:\n  enabled: true\n  indentWidth: 4\n");

    assert!(config.is_formatter_enabled());
    assert_eq!(config.formatter().unwrap().indent_width, Some(4));
  }

  #[test]
  fn uses_custom_version_when_provided() {
    let config = Config::from_object(&HerbConfigOptions::default(), Path::new("/project"), Some("1.2.3"), None).unwrap();

    assert_eq!(config.version(), "1.2.3");
  }
}

#[cfg(feature = "yerba")]
mod config_create_config_yaml_string {
  use super::*;

  #[test]
  fn creates_yaml_string_from_config_mutation() {
    let mutation: HerbConfigOptions = serde_yaml::from_str("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n").unwrap();

    let yaml = herb_config::create_config_yaml_string(&mutation, None).unwrap();

    assert!(yaml.contains("version:"));
    assert!(yaml.contains("linter:"));
    assert!(yaml.contains("rules:"));
    assert!(yaml.contains("html-tag-name-lowercase:"));
    assert!(yaml.contains("enabled: false"));
  }

  #[test]
  fn creates_yaml_string_with_formatter_config() {
    let mutation: HerbConfigOptions = serde_yaml::from_str("formatter:\n  enabled: true\n  indentWidth: 4\n").unwrap();

    let yaml = herb_config::create_config_yaml_string(&mutation, None).unwrap();

    assert!(yaml.contains("formatter:"));
    assert!(yaml.contains("enabled: true"));
    assert!(yaml.contains("indentWidth: 4"));
  }
}

#[cfg(feature = "yerba")]
mod config_apply_mutation_to_yaml_string {
  use super::*;

  fn disable(rule_name: &str) -> HerbConfigOptions {
    serde_yaml::from_str(&format!("linter:\n  rules:\n    {}:\n      enabled: false\n", rule_name)).unwrap()
  }

  #[test]
  fn applies_mutation_to_existing_yaml() {
    let original = "version: 0.10.3\nlinter:\n  enabled: true\n";

    let updated = herb_config::apply_mutation_to_yaml_string(original, &disable("html-tag-name-lowercase")).unwrap();

    assert!(updated.contains("version: 0.10.3"));
    assert!(updated.contains("enabled: true"));
    assert!(updated.contains("html-tag-name-lowercase:"));
    assert!(updated.contains("enabled: false"));
  }

  #[test]
  fn merges_rules_without_overwriting_existing_rules() {
    let original = "version: 0.10.3\nlinter:\n  rules:\n    html-img-require-alt:\n      enabled: false\n";

    let updated = herb_config::apply_mutation_to_yaml_string(original, &disable("html-tag-name-lowercase")).unwrap();

    assert!(updated.contains("html-img-require-alt:"));
    assert!(updated.contains("html-tag-name-lowercase:"));
  }

  #[test]
  fn updates_existing_rule_configuration() {
    let original = "version: 0.10.3\nlinter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n      severity: error\n";

    let updated = herb_config::apply_mutation_to_yaml_string(original, &disable("html-tag-name-lowercase")).unwrap();

    assert!(updated.contains("html-tag-name-lowercase:"));
    assert!(updated.contains("enabled: false"));
    assert!(updated.contains("severity: error"));
  }
}

mod config_instance_methods {
  use super::*;

  #[test]
  fn to_json_returns_json_string_of_config() {
    let config = config_from_yaml("linter:\n  enabled: true\n");

    let json: serde_json::Value = serde_json::from_str(&config.to_json()).unwrap();

    assert!(json.get("version").is_some());
    assert!(json.get("linter").is_some());
    assert_eq!(json["linter"]["enabled"], serde_json::Value::Bool(true));
  }

  #[test]
  fn get_configured_severity_returns_default_severity_when_not_configured() {
    assert_eq!(
      Config::default().get_configured_severity("rule-a", Severity::Error.into(), LinterMode::Cli),
      Severity::Error
    );
  }

  #[test]
  fn get_configured_severity_returns_configured_severity() {
    let config = config_from_yaml("linter:\n  rules:\n    rule-a:\n      severity: warning\n");

    assert_eq!(
      config.get_configured_severity("rule-a", Severity::Error.into(), LinterMode::Cli),
      Severity::Warning
    );
  }

  #[test]
  fn apply_severity_overrides_applies_configured_severities_to_offenses() {
    let config = config_from_yaml("linter:\n  rules:\n    html-img-require-alt:\n      severity: warning\n");

    let mut offenses = vec![offense("html-img-require-alt", Severity::Error), offense("erb-no-empty-tags", Severity::Error)];

    config.apply_severity_overrides(&mut offenses, LinterMode::Cli);

    assert_eq!(offenses[0].severity, Severity::Warning);
    assert_eq!(offenses[1].severity, Severity::Error);
  }

  #[test]
  fn resolve_severity_returns_the_value_directly_for_plain_severity() {
    assert_eq!(
      herb_config::resolve_severity(SeverityConfig::Severity(Severity::Warning), LinterMode::Cli),
      Severity::Warning
    );
    assert_eq!(
      herb_config::resolve_severity(SeverityConfig::Severity(Severity::Warning), LinterMode::Editor),
      Severity::Warning
    );
  }

  #[test]
  fn resolve_severity_returns_the_mode_specific_severity_for_object_severity() {
    let severity = SeverityConfig::PerMode {
      editor: Severity::Info,
      cli: Severity::Error,
    };

    assert_eq!(herb_config::resolve_severity(severity, LinterMode::Cli), Severity::Error);
    assert_eq!(herb_config::resolve_severity(severity, LinterMode::Editor), Severity::Info);
  }

  #[test]
  fn get_configured_severity_resolves_object_severity_with_mode() {
    let config = config_from_yaml("linter:\n  rules:\n    rule-a:\n      severity:\n        editor: hint\n        cli: error\n");

    assert_eq!(
      config.get_configured_severity("rule-a", Severity::Warning.into(), LinterMode::Editor),
      Severity::Hint
    );
    assert_eq!(
      config.get_configured_severity("rule-a", Severity::Warning.into(), LinterMode::Cli),
      Severity::Error
    );
  }

  #[test]
  fn get_configured_severity_falls_back_to_default_severity_when_rule_has_no_severity_config() {
    let config = config_from_yaml("linter:\n  rules:\n    rule-a:\n      enabled: true\n");

    assert_eq!(config.get_configured_severity("rule-a", Severity::Hint.into(), LinterMode::Cli), Severity::Hint);
  }

  #[test]
  fn apply_severity_overrides_resolves_object_severity_with_mode() {
    let config = config_from_yaml("linter:\n  rules:\n    html-img-require-alt:\n      severity:\n        editor: hint\n        cli: error\n");

    let mut offenses = vec![offense("html-img-require-alt", Severity::Info)];

    config.apply_severity_overrides(&mut offenses, LinterMode::Editor);

    assert_eq!(offenses[0].severity, Severity::Hint);
  }

  #[test]
  fn from_object_accepts_object_severity_in_rule_config() {
    let config = config_from_yaml("linter:\n  rules:\n    rule-a:\n      severity:\n        editor: info\n        cli: error\n");

    assert_eq!(
      config.get_configured_severity("rule-a", Severity::Warning.into(), LinterMode::Cli),
      Severity::Error
    );
    assert_eq!(
      config.get_configured_severity("rule-a", Severity::Warning.into(), LinterMode::Editor),
      Severity::Info
    );
  }

  #[test]
  fn is_linter_enabled_returns_true_when_linter_is_enabled() {
    assert!(config_from_yaml("linter:\n  enabled: true\n").is_linter_enabled());
  }

  #[test]
  fn is_linter_enabled_returns_false_when_linter_is_disabled() {
    assert!(!config_from_yaml("linter:\n  enabled: false\n").is_linter_enabled());
  }

  #[test]
  fn is_linter_enabled_returns_true_by_default() {
    assert!(Config::default().is_linter_enabled());
  }

  #[test]
  fn is_formatter_enabled_returns_true_when_formatter_is_enabled() {
    assert!(config_from_yaml("formatter:\n  enabled: true\n").is_formatter_enabled());
  }

  #[test]
  fn is_formatter_enabled_returns_false_when_formatter_is_disabled() {
    assert!(!config_from_yaml("formatter:\n  enabled: false\n").is_formatter_enabled());
  }

  #[test]
  fn is_formatter_enabled_returns_false_by_default() {
    assert!(!Config::default().is_formatter_enabled());
  }

  #[test]
  fn is_rule_disabled_returns_true_when_rule_is_disabled() {
    assert!(config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n").is_rule_disabled("html-tag-name-lowercase"));
  }

  #[test]
  fn is_rule_disabled_returns_false_when_rule_is_enabled() {
    assert!(!config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n").is_rule_disabled("html-tag-name-lowercase"));
  }

  #[test]
  fn is_rule_disabled_returns_false_when_rule_is_not_configured() {
    assert!(!config_from_yaml("linter:\n  rules:\n    erb-no-empty-tags:\n      severity: warning\n").is_rule_disabled("html-img-require-alt"));
  }

  #[test]
  fn is_rule_enabled_returns_false_when_rule_is_disabled() {
    assert!(!config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n").is_rule_enabled("html-tag-name-lowercase"));
  }

  #[test]
  fn is_rule_enabled_returns_true_when_rule_is_enabled() {
    assert!(config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n").is_rule_enabled("html-tag-name-lowercase"));
  }

  #[test]
  fn is_rule_enabled_returns_true_when_rule_is_not_configured() {
    assert!(config_from_yaml("linter:\n  rules:\n    erb-no-empty-tags:\n      severity: warning\n").is_rule_enabled("html-img-require-alt"));
  }

  #[test]
  fn default_rule_enabled_returns_none_when_all_is_not_configured() {
    assert_eq!(
      config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n").default_rule_enabled(),
      None
    );
  }

  #[test]
  fn default_rule_enabled_returns_the_all_pseudo_rule_setting() {
    assert_eq!(
      config_from_yaml("linter:\n  rules:\n    all:\n      enabled: false\n").default_rule_enabled(),
      Some(false)
    );
    assert_eq!(
      config_from_yaml("linter:\n  rules:\n    all:\n      enabled: true\n").default_rule_enabled(),
      Some(true)
    );
  }

  #[test]
  fn is_rule_disabled_returns_true_for_unconfigured_rules_when_all_is_disabled() {
    assert!(config_from_yaml("linter:\n  rules:\n    all:\n      enabled: false\n").is_rule_disabled("html-img-require-alt"));
  }

  #[test]
  fn is_rule_disabled_returns_false_for_rules_re_enabled_over_a_disabled_all() {
    let config = config_from_yaml("linter:\n  rules:\n    all:\n      enabled: false\n    html-img-require-alt:\n      enabled: true\n");

    assert!(!config.is_rule_disabled("html-img-require-alt"));
    assert!(config.is_rule_disabled("html-tag-name-lowercase"));
  }

  #[test]
  fn is_rule_disabled_returns_false_for_rules_configured_without_enabled_when_all_is_disabled() {
    let config = config_from_yaml("linter:\n  rules:\n    all:\n      enabled: false\n    html-img-require-alt:\n      severity: warning\n");

    assert!(!config.is_rule_disabled("html-img-require-alt"));
  }

  #[test]
  fn is_rule_disabled_returns_false_for_unconfigured_rules_when_all_is_enabled() {
    assert!(!config_from_yaml("linter:\n  rules:\n    all:\n      enabled: true\n").is_rule_disabled("html-img-require-alt"));
  }

  #[test]
  fn is_rule_disabled_still_honors_explicit_disables_when_all_is_enabled() {
    let config = config_from_yaml("linter:\n  rules:\n    all:\n      enabled: true\n    html-img-require-alt:\n      enabled: false\n");

    assert!(config.is_rule_disabled("html-img-require-alt"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_for_unconfigured_rules_when_all_is_disabled() {
    let config = config_from_yaml("linter:\n  rules:\n    all:\n      enabled: false\n    html-img-require-alt:\n      enabled: true\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
    assert!(config.is_rule_enabled_for_path("html-img-require-alt", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_linter_enabled_for_path_returns_true_when_no_exclude_patterns() {
    assert!(Config::default().is_linter_enabled_for_path("app/views/home/index.html.erb"));
  }

  #[test]
  fn is_linter_enabled_for_path_returns_false_when_path_matches_exclude_pattern() {
    assert!(!config_from_yaml("linter:\n  exclude:\n    - 'legacy/**/*'\n").is_linter_enabled_for_path("legacy/old.html.erb"));
  }

  #[test]
  fn is_linter_enabled_for_path_returns_true_when_path_does_not_match_exclude_pattern() {
    assert!(config_from_yaml("linter:\n  exclude:\n    - 'legacy/**/*'\n").is_linter_enabled_for_path("app/views/home/index.html.erb"));
  }

  #[test]
  fn is_linter_enabled_for_path_returns_false_when_linter_is_disabled() {
    assert!(!config_from_yaml("linter:\n  enabled: false\n").is_linter_enabled_for_path("app/views/home/index.html.erb"));
  }

  #[test]
  fn is_formatter_enabled_for_path_returns_true_when_no_exclude_patterns() {
    assert!(config_from_yaml("formatter:\n  enabled: true\n").is_formatter_enabled_for_path("app/views/home/index.html.erb"));
  }

  #[test]
  fn is_formatter_enabled_for_path_returns_false_when_path_matches_exclude_pattern() {
    let config = config_from_yaml("formatter:\n  enabled: true\n  exclude:\n    - 'generated/**/*'\n");

    assert!(!config.is_formatter_enabled_for_path("generated/out.html.erb"));
  }

  #[test]
  fn is_formatter_enabled_for_path_returns_false_when_formatter_is_disabled() {
    assert!(!config_from_yaml("formatter:\n  enabled: false\n").is_formatter_enabled_for_path("app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_true_when_no_exclude_patterns() {
    assert!(Config::default().is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_when_linter_is_disabled_for_path() {
    let config = config_from_yaml("linter:\n  exclude:\n    - 'legacy/**/*'\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/old.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_when_rule_is_disabled() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_when_path_matches_rule_specific_exclude() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      exclude:\n        - 'app/views/legacy/**/*'\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_true_when_path_does_not_match_rule_specific_exclude() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      exclude:\n        - 'app/views/legacy/**/*'\n");

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_true_when_path_matches_rule_specific_only() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      only:\n        - 'app/views/**/*'\n");

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_when_path_does_not_match_rule_specific_only() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      only:\n        - 'app/views/**/*'\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "lib/templates/email.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_respects_both_only_and_exclude_patterns() {
    let config = config_from_yaml(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      only:\n        - 'app/views/**/*'\n      exclude:\n        - 'app/views/legacy/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "lib/templates/email.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_true_when_path_matches_rule_specific_include() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'app/components/**/*'\n");

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_returns_false_when_path_does_not_match_rule_specific_include() {
    let config = config_from_yaml("linter:\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'app/components/**/*'\n");

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_respects_include_and_exclude_patterns() {
    let config = config_from_yaml(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'app/components/**/*'\n      exclude:\n        - 'app/components/legacy/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/legacy/old.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_only_overrides_include_patterns() {
    let config = config_from_yaml(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'app/components/**/*'\n      only:\n        - 'app/views/**/*'\n      exclude:\n        - 'app/views/legacy/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_rule_exclude_is_additive_with_linter_exclude() {
    let config = config_from_yaml(
      "linter:\n  exclude:\n    - 'vendor/**/*'\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n      exclude:\n        - 'legacy/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "vendor/bundle/file.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/old.html.erb"));
  }

  #[test]
  fn full_exclude_inheritance_chain_defaults_files_linter_rule() {
    let config = config_from_yaml(
      "files:\n  exclude:\n    - 'public/**/*'\nlinter:\n  exclude:\n    - 'legacy/**/*'\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n      exclude:\n        - 'generated/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "node_modules/pkg/file.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "public/assets/file.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/old.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "generated/output.html.erb"));
  }

  #[test]
  fn rule_include_can_override_parent_level_excludes() {
    let config = config_from_yaml(
      "files:\n  exclude:\n    - 'public/**/*'\nlinter:\n  exclude:\n    - 'legacy/**/*'\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'legacy/**/*'\n        - 'public/**/*'\n        - 'node_modules/**/*'\n      exclude:\n        - 'generated/**/*'\n",
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/index.html.erb"));
    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "public/page.html.erb"));
    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "node_modules/pkg/file.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "generated/output.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_normalizes_absolute_file_paths_against_project_path() {
    let config = config_from_yaml_in(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      exclude:\n        - 'app/views/layouts/**/*'\n",
      Path::new("/test/project"),
    );

    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/layouts/jasmine.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/app/views/layouts/jasmine.html.erb"));
    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_normalizes_absolute_file_paths_for_include_patterns() {
    let config = config_from_yaml_in(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      include:\n        - 'app/components/**/*'\n",
      Path::new("/test/project"),
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/app/components/button.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/app/views/home/index.html.erb"));
  }

  #[test]
  fn is_rule_enabled_for_path_normalizes_absolute_file_paths_for_only_patterns() {
    let config = config_from_yaml_in(
      "linter:\n  rules:\n    html-tag-name-lowercase:\n      only:\n        - 'app/views/**/*'\n",
      Path::new("/test/project"),
    );

    assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/app/views/home/index.html.erb"));
    assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "/test/project/lib/templates/email.html.erb"));
  }

  #[test]
  fn linter_exclude_combines_with_files_exclude_for_file_discovery() {
    let config = config_from_yaml("files:\n  exclude:\n    - 'public/**/*'\nlinter:\n  exclude:\n    - 'legacy/**/*'\n");

    assert_eq!(
      config.get_files_config_for_tool(Tool::Linter).exclude,
      Some(exclude_with(&["public/**/*", "legacy/**/*"]))
    );
  }

  #[test]
  fn is_enabled_for_path_works_for_linter_tool() {
    let config = config_from_yaml("linter:\n  exclude:\n    - 'legacy/**/*'\n");

    assert!(config.is_enabled_for_path("app/views/home/index.html.erb", Tool::Linter));
    assert!(!config.is_enabled_for_path("legacy/old.html.erb", Tool::Linter));
  }

  #[test]
  fn is_enabled_for_path_respects_defaults_and_files_exclude() {
    let config = config_from_yaml("files:\n  exclude:\n    - 'public/**/*'\n");

    assert!(config.is_enabled_for_path("app/views/index.html.erb", Tool::Linter));
    assert!(!config.is_enabled_for_path("public/index.html.erb", Tool::Linter));
    assert!(!config.is_enabled_for_path("node_modules/pkg/index.html.erb", Tool::Linter));
  }

  #[test]
  fn is_enabled_for_path_works_for_formatter_tool() {
    let config = config_from_yaml("formatter:\n  enabled: true\n  exclude:\n    - 'test/**/*'\n");

    assert!(config.is_enabled_for_path("app/views/home/index.html.erb", Tool::Formatter));
    assert!(!config.is_enabled_for_path("test/fixtures/sample.html.erb", Tool::Formatter));
  }

  #[test]
  fn get_files_config_for_tool_returns_default_patterns_when_no_config() {
    let files = Config::default().get_files_config_for_tool(Tool::Linter);

    assert_eq!(files.include, Some(default_include_patterns()));
    assert_eq!(files.exclude, Some(default_exclude_patterns()));
  }

  #[test]
  fn get_files_config_for_tool_combines_tool_specific_with_defaults() {
    let config = config_from_yaml("linter:\n  include:\n    - '**/*.xml.erb'\n  exclude:\n    - 'legacy/**/*'\n");

    let files = config.get_files_config_for_tool(Tool::Linter);

    assert_eq!(files.include, Some(include_with(&["**/*.xml.erb"])));
    assert_eq!(files.exclude, Some(exclude_with(&["legacy/**/*"])));
  }

  #[test]
  fn get_files_config_for_tool_combines_top_level_with_defaults() {
    let config = config_from_yaml("files:\n  include:\n    - '**/*.xml'\n  exclude:\n    - 'public/**/*'\n");

    let files = config.get_files_config_for_tool(Tool::Linter);

    assert_eq!(files.include, Some(include_with(&["**/*.xml"])));
    assert_eq!(files.exclude, Some(exclude_with(&["public/**/*"])));
  }

  #[test]
  fn exclude_patterns_that_duplicate_defaults_result_in_duplicates() {
    let config = config_from_yaml("files:\n  exclude:\n    - 'vendor/**/*'\n");

    assert_eq!(config.get_files_config_for_tool(Tool::Linter).exclude, Some(exclude_with(&["vendor/**/*"])));
  }

  #[test]
  fn get_files_config_for_tool_combines_all_levels_default_top_and_tool() {
    let config = config_from_yaml(
      "files:\n  include:\n    - '**/*.xml'\n  exclude:\n    - 'public/**/*'\nformatter:\n  include:\n    - '**/*.custom.erb'\n  exclude:\n    - 'test/**/*'\n",
    );

    let files = config.get_files_config_for_tool(Tool::Formatter);

    assert_eq!(files.include, Some(include_with(&["**/*.xml", "**/*.custom.erb"])));
    assert_eq!(files.exclude, Some(exclude_with(&["public/**/*", "test/**/*"])));
  }

  #[test]
  fn files_config_for_linter_adds_to_defaults() {
    let config = config_from_yaml("linter:\n  include:\n    - '**/*.xml.erb'\n  exclude:\n    - 'legacy/**/*'\n");

    assert_eq!(config.files_config_for_linter().include, Some(include_with(&["**/*.xml.erb"])));
    assert_eq!(config.files_config_for_linter().exclude, Some(exclude_with(&["legacy/**/*"])));
  }

  #[test]
  fn files_config_for_formatter_adds_to_defaults() {
    let config = config_from_yaml("formatter:\n  include:\n    - '**/*.custom.erb'\n");

    assert_eq!(config.files_config_for_formatter().include, Some(include_with(&["**/*.custom.erb"])));
  }

  #[test]
  fn files_config_for_linter_uses_default_patterns_when_none_specified() {
    let config = Config::default();

    assert_eq!(config.files_config_for_linter().include, Some(default_include_patterns()));
    assert_eq!(config.files_config_for_linter().exclude, Some(default_exclude_patterns()));
  }

  #[test]
  fn files_config_for_formatter_combines_with_top_level() {
    let config = config_from_yaml("files:\n  include:\n    - '**/*.custom.erb'\n  exclude:\n    - 'custom-exclude/**/*'\n");

    assert_eq!(config.files_config_for_formatter().include, Some(include_with(&["**/*.custom.erb"])));
    assert_eq!(config.files_config_for_formatter().exclude, Some(exclude_with(&["custom-exclude/**/*"])));
  }

  #[test]
  fn get_files_config_for_tool_combines_at_all_levels() {
    let config = config_from_yaml("files:\n  include:\n    - '**/*.xml'\nlinter:\n  include:\n    - '**/*.custom.erb'\n");

    assert_eq!(
      config.get_files_config_for_tool(Tool::Linter).include,
      Some(include_with(&["**/*.xml", "**/*.custom.erb"]))
    );
    assert_eq!(config.get_files_config_for_tool(Tool::Formatter).include, Some(include_with(&["**/*.xml"])));
  }

  #[test]
  fn find_files_for_tool_uses_defaults() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    let second = create_test_file(dir.path(), "app/views/posts/show.html.erb");
    create_test_file(dir.path(), "app/views/layout.xml");

    let config = Config::from_object(&HerbConfigOptions::default(), dir.path(), None, None).unwrap();

    assert_eq!(sorted(config.find_files_for_tool(Tool::Linter, Some(dir.path()))), sorted(vec![first, second]));
  }

  #[test]
  fn find_files_for_tool_excludes_patterns() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    create_test_file(dir.path(), "vendor/bundle/gem/file.html.erb");

    let config = config_from_yaml_in("linter:\n  exclude:\n    - 'vendor/**/*'\n", dir.path());

    assert_eq!(config.find_files_for_tool(Tool::Linter, Some(dir.path())), vec![first]);
  }

  #[test]
  fn find_files_for_tool_adds_custom_patterns_to_defaults() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    let second = create_test_file(dir.path(), "app/views/posts/show.xml.erb");

    let config = config_from_yaml_in("formatter:\n  include:\n    - '**/*.xml.erb'\n", dir.path());

    assert_eq!(
      sorted(config.find_files_for_tool(Tool::Formatter, Some(dir.path()))),
      sorted(vec![first, second])
    );
  }

  #[test]
  fn find_files_for_linter_finds_linter_files() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    let second = create_test_file(dir.path(), "app/views/posts/show.html.erb");

    let config = Config::from_object(&HerbConfigOptions::default(), dir.path(), None, None).unwrap();

    assert_eq!(sorted(config.find_files_for_linter(Some(dir.path()))), sorted(vec![first, second]));
  }

  #[test]
  fn find_files_for_formatter_finds_formatter_files() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    create_test_file(dir.path(), "app/views/home/other.xml");

    let config = Config::from_object(&HerbConfigOptions::default(), dir.path(), None, None).unwrap();

    assert_eq!(config.find_files_for_formatter(Some(dir.path())), vec![first]);
  }

  #[test]
  fn find_files_for_tool_can_exclude_defaults() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    create_test_file(dir.path(), "app/views/posts/show.html.erb");

    let config = config_from_yaml_in("linter:\n  exclude:\n    - 'app/views/posts/**/*'\n", dir.path());

    assert_eq!(config.find_files_for_tool(Tool::Linter, Some(dir.path())), vec![first]);
  }

  #[test]
  fn find_files_for_tool_combines_all_include_patterns() {
    let dir = tempfile::tempdir().unwrap();

    let first = create_test_file(dir.path(), "app/views/home/index.html.erb");
    let second = create_test_file(dir.path(), "app/views/posts/show.xml.erb");
    create_test_file(dir.path(), "config/routes.rb");

    let config = config_from_yaml_in("linter:\n  include:\n    - '**/*.xml.erb'\n", dir.path());

    assert_eq!(sorted(config.find_files_for_tool(Tool::Linter, Some(dir.path()))), sorted(vec![first, second]));
  }
}

mod default_patterns {
  use super::*;

  #[test]
  fn includes_common_erb_file_patterns() {
    let patterns = default_include_patterns();

    assert!(patterns.contains(&"**/*.html.erb".to_string()));
    assert!(patterns.contains(&"**/*.html".to_string()));
    assert!(patterns.contains(&"**/*.rhtml".to_string()));
    assert!(patterns.contains(&"**/*.turbo_stream.erb".to_string()));
    assert!(patterns.contains(&"**/*.herb".to_string()));
    assert!(patterns.contains(&"**/*.html.herb".to_string()));
    assert!(patterns.contains(&"**/*.html+*.erb".to_string()));
  }
}

mod config_version {
  use super::*;

  #[test]
  fn is_none_when_not_provided() {
    assert!(Config::default().config_version.is_none());
  }

  #[test]
  fn preserves_explicit_config_version() {
    let config = Config::new(Path::new("/project"), HerbConfig::default(), Some("0.9.0".to_string()));

    assert_eq!(config.config_version, Some("0.9.0".to_string()));
  }

  #[test]
  fn from_object_passes_config_version_through() {
    let config = Config::from_object(&HerbConfigOptions::default(), Path::new("/project"), None, Some("0.9.0".to_string())).unwrap();

    assert_eq!(config.config_version, Some("0.9.0".to_string()));
  }

  #[test]
  fn from_object_defaults_config_version_to_none_when_not_specified() {
    let config = Config::from_object(&HerbConfigOptions::default(), Path::new("/project"), None, None).unwrap();

    assert!(config.config_version.is_none());
  }

  #[test]
  fn load_preserves_user_config_version_from_herb_yml() {
    let dir = tempfile::tempdir().unwrap();

    fs::write(dir.path().join(".herb.yml"), "version: 0.9.0\n").unwrap();

    let config = Config::load(dir.path(), None).unwrap();

    assert_eq!(config.config_version, Some("0.9.0".to_string()));
    assert_eq!(config.version(), herb_config::DEFAULT_VERSION);
  }

  #[test]
  fn load_defaults_config_version_to_none_when_herb_yml_has_no_version() {
    let dir = tempfile::tempdir().unwrap();

    fs::write(dir.path().join(".herb.yml"), "linter:\n  enabled: true\n").unwrap();

    assert!(Config::load(dir.path(), None).unwrap().config_version.is_none());
  }

  #[test]
  fn load_defaults_config_version_to_none_when_no_herb_yml_exists() {
    let dir = tempfile::tempdir().unwrap();

    assert!(Config::load(dir.path(), None).unwrap().config_version.is_none());
  }
}

#[cfg(feature = "yerba")]
mod config_upgrade_workflow {
  use super::*;

  #[test]
  fn mutate_config_file_adds_disabled_rules() {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join(".herb.yml");

    fs::write(&config_path, "version: 0.8.0\n\nlinter:\n  enabled: true\n").unwrap();

    let mutation: HerbConfigOptions =
      serde_yaml::from_str("linter:\n  rules:\n    new-rule-a:\n      enabled: false\n    new-rule-b:\n      enabled: false\n").unwrap();

    herb_config::mutate_config_file(&config_path, &mutation, None).unwrap();

    let config = Config::load(dir.path(), None).unwrap();
    let rules = config.linter().unwrap().rules.as_ref().unwrap();

    assert_eq!(rules["new-rule-a"].enabled, Some(false));
    assert_eq!(rules["new-rule-b"].enabled, Some(false));
  }

  #[test]
  fn mutate_config_file_preserves_existing_rules() {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join(".herb.yml");

    fs::write(
      &config_path,
      "version: 0.8.0\n\nlinter:\n  enabled: true\n  rules:\n    existing-rule:\n      enabled: false\n",
    )
    .unwrap();

    let mutation: HerbConfigOptions = serde_yaml::from_str("linter:\n  rules:\n    new-rule:\n      enabled: false\n").unwrap();

    herb_config::mutate_config_file(&config_path, &mutation, None).unwrap();

    let config = Config::load(dir.path(), None).unwrap();
    let rules = config.linter().unwrap().rules.as_ref().unwrap();

    assert_eq!(rules["existing-rule"].enabled, Some(false));
    assert_eq!(rules["new-rule"].enabled, Some(false));
  }

  #[test]
  fn version_can_be_updated_via_file_content_replacement() {
    let dir = tempfile::tempdir().unwrap();
    let config_path = dir.path().join(".herb.yml");

    fs::write(&config_path, "version: 0.8.0\n\nlinter:\n  enabled: true\n").unwrap();

    let contents = fs::read_to_string(&config_path).unwrap().replace("version: 0.8.0", "version: 0.10.3");
    fs::write(&config_path, contents).unwrap();

    assert_eq!(Config::load(dir.path(), None).unwrap().config_version, Some("0.10.3".to_string()));
  }
}
