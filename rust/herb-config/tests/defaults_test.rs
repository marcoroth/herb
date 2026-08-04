use std::fs;
use std::path::Path;

use herb_config::{Config, HerbConfigOptions, Severity, Tool};

fn config_from_yaml(yaml: &str) -> Config {
  let options: HerbConfigOptions = serde_yaml::from_str(yaml).unwrap();

  Config::from_object(&options, Path::new("/project"), None, None).unwrap()
}

#[test]
fn default_exclude_patterns_contains_common_directories() {
  let patterns = Config::default().files_config_for_linter().exclude.unwrap();

  assert!(patterns.contains(&"coverage/**/*".to_string()));
  assert!(patterns.contains(&"log/**/*".to_string()));
  assert!(patterns.contains(&"node_modules/**/*".to_string()));
  assert!(patterns.contains(&"storage/**/*".to_string()));
  assert!(patterns.contains(&"tmp/**/*".to_string()));
  assert!(patterns.contains(&"vendor/**/*".to_string()));
}

#[test]
fn default_config_has_default_formatter_settings() {
  let config = Config::default();
  let formatter = config.formatter().unwrap();

  assert_eq!(formatter.indent_width, Some(2));
  assert_eq!(formatter.max_line_length, Some(80));
}

#[test]
fn linter_and_formatter_patterns_are_independent() {
  let config =
    config_from_yaml("files:\n  include:\n    - '**/*.xml'\nlinter:\n  include:\n    - '**/*.custom.erb'\nformatter:\n  include:\n    - '**/*.special.erb'\n");

  let linter = config.files_config_for_linter().include.unwrap();
  let formatter = config.files_config_for_formatter().include.unwrap();

  assert!(linter.contains(&"**/*.xml".to_string()));
  assert!(formatter.contains(&"**/*.xml".to_string()));

  assert!(linter.contains(&"**/*.custom.erb".to_string()));
  assert!(!linter.contains(&"**/*.special.erb".to_string()));

  assert!(formatter.contains(&"**/*.special.erb".to_string()));
  assert!(!formatter.contains(&"**/*.custom.erb".to_string()));
}

#[test]
fn fail_level_parses_from_yaml() {
  let config = config_from_yaml("linter:\n  failLevel: warning\n");

  assert_eq!(config.linter().unwrap().fail_level, Some(Severity::Warning));
}

#[test]
fn fail_level_defaults_to_none() {
  assert_eq!(Config::default().linter().unwrap().fail_level, None);
}

#[test]
fn log_level_parses_from_yaml() {
  let config = config_from_yaml("linter:\n  logLevel: warning\n");

  assert_eq!(config.linter().unwrap().log_level, Some(Severity::Warning));
}

#[test]
fn log_level_defaults_to_none() {
  assert_eq!(Config::default().linter().unwrap().log_level, None);
}

#[test]
fn has_rule_exclude_reports_user_configured_excludes() {
  let config = config_from_yaml("linter:\n  rules:\n    rule-a:\n      exclude:\n        - 'a/**/*'\n    rule-b:\n      enabled: true\n");

  assert!(config.has_rule_exclude("rule-a"));
  assert!(!config.has_rule_exclude("rule-b"));
  assert!(!config.has_rule_exclude("rule-c"));
}

#[test]
fn find_files_for_linter_only_matches_configured_patterns() {
  let dir = tempfile::tempdir().unwrap();
  let root = dir.path();

  fs::create_dir_all(root.join("app/views")).unwrap();
  fs::create_dir_all(root.join("node_modules/package")).unwrap();

  fs::write(root.join("app/views/index.html.erb"), "").unwrap();
  fs::write(root.join("app/views/show.turbo_stream.erb"), "").unwrap();
  fs::write(root.join("app/views/application.js.erb"), "").unwrap();
  fs::write(root.join("app/views/mailer.text.erb"), "").unwrap();
  fs::write(root.join("app/views/partial.erb"), "").unwrap();
  fs::write(root.join("app/views/page.html"), "").unwrap();
  fs::write(root.join("node_modules/package/index.html.erb"), "").unwrap();

  let config = Config::default();
  let files = config.find_files_for_linter(Some(root));

  let names: Vec<String> = files
    .iter()
    .map(|file| Path::new(file).strip_prefix(root).unwrap().to_string_lossy().into_owned())
    .collect();

  assert_eq!(
    names,
    vec![
      "app/views/index.html.erb".to_string(),
      "app/views/page.html".to_string(),
      "app/views/show.turbo_stream.erb".to_string(),
    ]
  );
}

#[test]
fn find_files_for_tool_returns_empty_when_no_include_patterns() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join("index.html.erb"), "").unwrap();

  let mut config = Config::default();
  config.config.files = None;

  assert!(config.find_files_for_tool(Tool::Linter, Some(dir.path())).is_empty());
}
