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
version: 0.10.2
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

  assert_eq!(config.config_version, Some("0.10.2".into()));
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

#[test]
fn read_raw_yaml_errors_when_the_file_is_missing() {
  let dir = tempfile::tempdir().unwrap();

  assert!(Config::read_raw_yaml(dir.path()).is_err());
}

#[test]
fn find_config_file_finds_config_in_current_dir() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "version: 0.10.2\n").unwrap();

  let found = Config::find_config_file(dir.path());

  assert_eq!(found.config_path, Some(fs::canonicalize(&config_path).unwrap()));
  assert_eq!(found.project_root, fs::canonicalize(dir.path()).unwrap());
}

#[test]
fn find_config_file_walks_up_directory_tree() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  fs::write(&config_path, "version: 0.10.2\n").unwrap();

  let sub_dir = dir.path().join("app").join("views");
  fs::create_dir_all(&sub_dir).unwrap();

  let found = Config::find_config_file(&sub_dir);

  assert_eq!(found.config_path, Some(fs::canonicalize(&config_path).unwrap()));
}
