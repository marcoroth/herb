#![cfg(feature = "yerba")]

use std::fs;

use herb_config::{apply_mutation_to_yaml_string, create_config_yaml_string, mutate_config_file, HerbConfigOptions};

fn disable(rule_name: &str) -> HerbConfigOptions {
  serde_yaml::from_str(&format!("linter:\n  rules:\n    {}:\n      enabled: false\n", rule_name)).unwrap()
}

#[test]
fn create_config_yaml_string_substitutes_the_version() {
  let yaml = create_config_yaml_string(&HerbConfigOptions::default(), Some("0.11.0")).unwrap();

  assert!(yaml.contains("version: 0.11.0"));
  assert!(!yaml.contains("version: 0.10.2"));
}

#[test]
fn create_config_yaml_string_keeps_the_template_comments() {
  let yaml = create_config_yaml_string(&HerbConfigOptions::default(), None).unwrap();

  assert!(yaml.contains("# This file configures Herb for your project and team."));
  assert!(yaml.contains("# Website: https://herb-tools.dev"));
}

#[test]
fn disabling_a_rule_preserves_surrounding_comments_and_blank_lines() {
  let original = "# my project config\nversion: 0.10.2\n\nlinter:\n  enabled: true\n\n  # keep this note\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n\nformatter:\n  enabled: false\n";

  let updated = apply_mutation_to_yaml_string(original, &disable("html-tag-name-lowercase")).unwrap();

  assert!(updated.contains("# my project config"));
  assert!(updated.contains("# keep this note"));
  assert!(updated.contains("enabled: false"));
  assert!(updated.contains("formatter:"));
  assert_eq!(updated.matches("\n\n").count(), original.matches("\n\n").count());
}

#[test]
fn disabling_a_rule_creates_the_rules_map_when_absent() {
  let original = "version: 0.10.2\n\nlinter:\n  enabled: true\n";

  let updated = apply_mutation_to_yaml_string(original, &disable("html-img-require-alt")).unwrap();

  assert!(updated.contains("rules:"));
  assert!(updated.contains("html-img-require-alt:"));
  assert!(updated.contains("enabled: false"));
}

#[test]
fn mutate_config_file_writes_in_place_and_creates_when_missing() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  mutate_config_file(&config_path, &HerbConfigOptions::default(), Some("0.10.2")).unwrap();
  assert!(config_path.exists());

  let created = fs::read_to_string(&config_path).unwrap();
  assert!(created.contains("# This file configures Herb for your project and team."));

  mutate_config_file(&config_path, &disable("erb-no-empty-tags"), None).unwrap();

  let updated = fs::read_to_string(&config_path).unwrap();
  assert!(updated.contains("# This file configures Herb for your project and team."));
  assert!(updated.contains("erb-no-empty-tags:"));
}
