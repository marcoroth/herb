use std::fs;
use std::path::Path;

use herb_config::Config;

#[test]
fn load_reads_and_merges_with_defaults() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(
    &config_path,
    r#"
version: 0.10.3
linter:
  enabled: true
  rules:
    html-tag-name-lowercase:
      enabled: false
formatter:
  enabled: false
  indentWidth: 4
  maxLineLength: 120
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert_eq!(config.config_version, Some("0.10.3".into()));
  assert_eq!(config.version(), herb_config::DEFAULT_VERSION);

  assert!(config.is_linter_enabled());
  assert!(!config.is_formatter_enabled());

  assert_eq!(config.formatter().unwrap().indent_width, Some(4));
  assert_eq!(config.formatter().unwrap().max_line_length, Some(120));

  assert!(config.is_rule_disabled("html-tag-name-lowercase"));

  assert!(config.files_config_for_linter().include.unwrap().contains(&"**/*.html.erb".to_string()));
}

#[test]
fn load_returns_defaults_when_no_config_file_exists() {
  let dir = tempfile::tempdir().unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert!(config.is_linter_enabled());
  assert_eq!(config.files_config_for_linter().include, Some(Config::get_default_file_patterns()));
}

#[test]
fn load_returns_error_for_invalid_yaml() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "linter:\n\tenabled: true\n").unwrap();

  assert!(Config::load(&config_path, None).is_err());
}

#[test]
fn load_returns_error_for_unknown_keys() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "linter:\n  notARealKey: true\n").unwrap();

  assert!(Config::load(&config_path, None).is_err());
}

#[test]
fn load_accepts_engine_options_it_does_not_know_about() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(
    &config_path,
    r#"
version: 0.10.3
engine:
  slots: true
  parser_options:
    timeout: 5
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();
  let engine = config.config.engine.unwrap();

  assert_eq!(engine.get("slots").unwrap().as_bool(), Some(true));
  assert_eq!(engine.get("parser_options").unwrap().get("timeout").unwrap().as_u64(), Some(5));
}

#[test]
fn load_accepts_an_empty_engine_section() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yml"), "version: 0.10.3\nengine:\n").unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert!(config.is_linter_enabled());
}

#[test]
fn load_returns_error_when_the_engine_section_is_not_a_mapping() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "engine: true\n").unwrap();

  assert!(Config::load(&config_path, None).is_err());
}

#[test]
fn load_from_explicit_path_returns_error_when_missing() {
  assert!(Config::load(Path::new("/nonexistent/.herb.yml"), None).is_err());
}

#[test]
fn load_for_editor_does_not_create_a_config_file() {
  let dir = tempfile::tempdir().unwrap();

  let config = Config::load_for_editor(dir.path(), None).unwrap();

  assert!(config.is_linter_enabled());
  assert!(!dir.path().join(".herb.yml").exists());
}

fn load_error(config_content: &str, version: &str) -> String {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yml"), config_content).unwrap();

  Config::load(dir.path(), Some(version)).unwrap_err()
}

#[test]
fn explains_the_skew_when_the_config_declares_a_newer_version_than_the_one_running() {
  let error = load_error("version: 0.10.3\nunknown_key: value\n", "0.9.2");

  assert!(error.contains("Configuration errors in"));
  assert!(error.contains("This configuration declares version 0.10.3, but Herb 0.9.2 is running"));
  assert!(error.contains("Upgrade Herb to 0.10.3 or newer"));
}

#[test]
fn does_not_explain_the_skew_when_the_config_declares_an_older_version() {
  let error = load_error("version: 0.9.2\nunknown_key: value\n", "0.10.3");

  assert!(error.contains("Configuration errors in"));
  assert!(!error.contains("declares version"));
}

#[test]
fn does_not_explain_the_skew_when_the_versions_match() {
  let error = load_error("version: 0.10.3\nunknown_key: value\n", "0.10.3");

  assert!(!error.contains("declares version"));
}

#[test]
fn does_not_explain_the_skew_when_the_config_has_no_version() {
  let error = load_error("unknown_key: value\n", "0.9.2");

  assert!(!error.contains("declares version"));
}

#[test]
fn does_not_report_a_skew_for_a_valid_config() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yml"), "version: 0.10.3\n\nlinter:\n  enabled: true\n").unwrap();

  let config = Config::load(dir.path(), Some("0.9.2")).unwrap();

  assert_eq!(config.config_version.as_deref(), Some("0.10.3"));
}

#[test]
fn read_raw_yaml_errors_when_the_file_is_missing() {
  let dir = tempfile::tempdir().unwrap();

  assert!(Config::read_raw_yaml(dir.path()).is_err());
}

#[test]
fn find_config_file_finds_config_in_current_dir() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "version: 0.10.3\n").unwrap();

  let found = Config::find_config_file(dir.path());

  assert_eq!(found.config_path, Some(fs::canonicalize(&config_path).unwrap()));
  assert_eq!(found.project_root, fs::canonicalize(dir.path()).unwrap());
}

#[test]
fn find_config_file_walks_up_directory_tree() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "version: 0.10.3\n").unwrap();

  let sub_dir = dir.path().join("app").join("views");
  fs::create_dir_all(&sub_dir).unwrap();

  let found = Config::find_config_file(&sub_dir);

  assert_eq!(found.config_path, Some(fs::canonicalize(&config_path).unwrap()));
}

#[test]
fn load_supports_yaml_anchors_and_aliases() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(
    &config_path,
    r#"
version: 0.10.3
files:
  include: &patterns
    - "**/*.custom.erb"
    - "**/*.other.erb"
  exclude: *patterns
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();
  let files = config.files_config_for_linter();

  assert!(files.include.as_ref().unwrap().contains(&"**/*.custom.erb".to_string()));
  assert!(files.include.as_ref().unwrap().contains(&"**/*.other.erb".to_string()));
  assert!(files.exclude.as_ref().unwrap().contains(&"**/*.custom.erb".to_string()));
  assert!(files.exclude.as_ref().unwrap().contains(&"**/*.other.erb".to_string()));
}

#[test]
fn load_supports_yaml_merge_keys() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(
    dir.path().join(".herb.yml"),
    r#"
version: 0.10.3
linter:
  rules: &rules
    html-tag-name-lowercase:
      enabled: false
formatter:
  enabled: false
  indentWidth: 4
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert!(config.is_rule_disabled("html-tag-name-lowercase"));
  assert!(!config.is_formatter_enabled());
}

#[test]
fn load_merges_a_mapping_that_uses_a_merge_key() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(
    dir.path().join(".herb.yml"),
    r#"
version: 0.10.3
linter:
  rules:
    html-tag-name-lowercase: &disabled
      enabled: false
    html-no-self-closing:
      <<: *disabled
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert!(config.is_rule_disabled("html-tag-name-lowercase"));
  assert!(config.is_rule_disabled("html-no-self-closing"));
}

#[test]
fn load_ignores_anchor_definition_keys() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(
    dir.path().join(".herb.yml"),
    r#"
version: 0.10.3
x-defaults: &defaults
  enabled: false
formatter:
  <<: *defaults
  indentWidth: 2
"#,
  )
  .unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert!(!config.is_formatter_enabled());
  assert_eq!(config.formatter().unwrap().indent_width, Some(2));
}

#[test]
fn load_still_rejects_unknown_top_level_keys() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "version: 0.10.3\ndefaults: true\n").unwrap();

  assert!(Config::load(&config_path, None).is_err());
}
