use std::fs;
use std::path::Path;

use herb_config::{Config, MISNAMED_CONFIG_PATHS};

#[test]
fn misnamed_config_paths_covers_the_extension_and_the_missing_leading_dot() {
  assert_eq!(MISNAMED_CONFIG_PATHS, &[".herb.yaml", "herb.yml", "herb.yaml"]);
}

#[test]
fn is_misnamed_config_path_recognizes_misnamed_config_files() {
  assert!(Config::is_misnamed_config_path(Path::new(".herb.yaml")));
  assert!(Config::is_misnamed_config_path(Path::new("herb.yml")));
  assert!(Config::is_misnamed_config_path(Path::new("herb.yaml")));
  assert!(Config::is_misnamed_config_path(Path::new("/project/.herb.yaml")));
}

#[test]
fn is_misnamed_config_path_ignores_the_real_config_file() {
  assert!(!Config::is_misnamed_config_path(Path::new(".herb.yml")));
  assert!(!Config::is_misnamed_config_path(Path::new("/project/.herb.yml")));
}

#[test]
fn is_misnamed_config_path_ignores_unrelated_yaml_files() {
  assert!(!Config::is_misnamed_config_path(Path::new("config.yml")));
  assert!(!Config::is_misnamed_config_path(Path::new("myherb.yml")));
  assert!(!Config::is_misnamed_config_path(Path::new(".herb.yml.bak")));
}

#[test]
fn find_misnamed_config_paths_returns_every_misnamed_config_file() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yaml"), "").unwrap();
  fs::write(dir.path().join("herb.yaml"), "").unwrap();

  let found = Config::find_misnamed_config_paths(dir.path());

  assert_eq!(found, vec![dir.path().join(".herb.yaml"), dir.path().join("herb.yaml")]);
}

#[test]
fn find_misnamed_config_paths_ignores_the_real_config_file() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yml"), "").unwrap();

  assert!(Config::find_misnamed_config_paths(dir.path()).is_empty());
}

#[test]
fn misnamed_config_warning_names_the_file_and_the_fix() {
  let warning = Config::misnamed_config_warning(Path::new("/project/.herb.yaml"));

  assert_eq!(
    warning,
    "\u{26a0} Ignoring /project/.herb.yaml: Herb only reads `.herb.yml`. Rename it to `.herb.yml` to apply it."
  );
}

#[test]
fn load_still_uses_the_real_config_file_next_to_a_misnamed_one() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yml"), "version: 0.10.3\nformatter:\n  indentWidth: 4\n").unwrap();
  fs::write(dir.path().join(".herb.yaml"), "version: 0.10.3\nformatter:\n  indentWidth: 8\n").unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert_eq!(config.path.file_name().unwrap(), ".herb.yml");
  assert_eq!(config.formatter().unwrap().indent_width, Some(4));
}

#[test]
fn load_ignores_a_misnamed_config_file_and_falls_back_to_defaults() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join("Gemfile"), "").unwrap();
  fs::write(dir.path().join(".herb.yaml"), "version: 0.10.3\nformatter:\n  indentWidth: 8\n").unwrap();

  let config = Config::load(dir.path(), None).unwrap();

  assert_eq!(config.config_version, None);
  assert_ne!(config.formatter().unwrap().indent_width, Some(8));
}

#[cfg(feature = "yerba")]
#[test]
fn load_for_cli_creates_the_default_config_next_to_a_misnamed_one() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join("Gemfile"), "").unwrap();
  fs::write(dir.path().join(".herb.yaml"), "version: 0.10.3\n").unwrap();

  let config = Config::load_for_cli(dir.path(), None, true).unwrap();

  assert_eq!(config.path.file_name().unwrap(), ".herb.yml");
  assert!(dir.path().join(".herb.yml").exists());
}
