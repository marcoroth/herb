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
  assert!(!yaml.contains("version: 0.10.3"));
}

#[test]
fn create_config_yaml_string_keeps_the_template_comments() {
  let yaml = create_config_yaml_string(&HerbConfigOptions::default(), None).unwrap();

  assert!(yaml.contains("# This file configures Herb for your project and team."));
  assert!(yaml.contains("# Website: https://herb-tools.dev"));
}

#[test]
fn disabling_a_rule_preserves_surrounding_comments_and_blank_lines() {
  let original = "# my project config\nversion: 0.10.3\n\nlinter:\n  enabled: true\n\n  # keep this note\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n\nformatter:\n  enabled: false\n";

  let updated = apply_mutation_to_yaml_string(original, &disable("html-tag-name-lowercase")).unwrap();

  assert!(updated.contains("# my project config"));
  assert!(updated.contains("# keep this note"));
  assert!(updated.contains("enabled: false"));
  assert!(updated.contains("formatter:"));
  assert_eq!(updated.matches("\n\n").count(), original.matches("\n\n").count());
}

#[test]
fn disabling_a_rule_creates_the_rules_map_when_absent() {
  let original = "version: 0.10.3\n\nlinter:\n  enabled: true\n";

  let updated = apply_mutation_to_yaml_string(original, &disable("html-img-require-alt")).unwrap();

  assert!(updated.contains("rules:"));
  assert!(updated.contains("html-img-require-alt:"));
  assert!(updated.contains("enabled: false"));
}

#[test]
fn mutate_config_file_writes_in_place_and_creates_when_missing() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");

  mutate_config_file(&config_path, &HerbConfigOptions::default(), Some("0.10.3")).unwrap();
  assert!(config_path.exists());

  let created = fs::read_to_string(&config_path).unwrap();
  assert!(created.contains("# This file configures Herb for your project and team."));

  mutate_config_file(&config_path, &disable("erb-no-empty-tags"), None).unwrap();

  let updated = fs::read_to_string(&config_path).unwrap();
  assert!(updated.contains("# This file configures Herb for your project and team."));
  assert!(updated.contains("erb-no-empty-tags:"));
}

#[test]
fn mutating_a_sequence_value_produces_loadable_yaml() {
  let original = "version: 0.10.3\n\nfiles:\n  include:\n    - \"**/*.custom.erb\"\n  exclude:\n    - \"**/*.old.erb\"\n";
  let mutation: HerbConfigOptions = serde_yaml::from_str("files:\n  include:\n    - \"**/*.new.erb\"\n").unwrap();

  let updated = apply_mutation_to_yaml_string(original, &mutation).unwrap();
  let parsed: serde_yaml::Value = serde_yaml::from_str(&updated).unwrap();

  let include = parsed["files"]["include"].as_sequence().unwrap();

  assert_eq!(include.len(), 1);
  assert_eq!(include[0].as_str().unwrap(), "**/*.new.erb");
  assert_eq!(parsed["files"]["exclude"][0].as_str().unwrap(), "**/*.old.erb");
}

#[test]
fn mutating_a_config_with_anchors_and_aliases_keeps_it_loadable() {
  let original = "version: 0.10.3\n\nlinter:\n  enabled: &flag true\n\nformatter:\n  enabled: *flag\n";
  let mutation: HerbConfigOptions = serde_yaml::from_str("linter:\n  enabled: false\n").unwrap();

  let updated = apply_mutation_to_yaml_string(original, &mutation).unwrap();

  serde_yaml::from_str::<serde_yaml::Value>(&updated).expect("mutated config must still load");
}

#[test]
fn a_mutation_that_would_produce_invalid_yaml_is_rejected() {
  let original = "version: 0.10.3\n\nfiles:\n  include: &patterns\n    - \"a.erb\"\n  exclude: *patterns\n";
  let mutation: HerbConfigOptions = serde_yaml::from_str("files:\n  include:\n    - \"b.erb\"\n").unwrap();

  match apply_mutation_to_yaml_string(original, &mutation) {
    Ok(updated) => {
      serde_yaml::from_str::<serde_yaml::Value>(&updated).expect("if the mutation is applied the result must load");
    }
    Err(error) => assert!(error.contains("invalid YAML"), "unexpected error: {}", error),
  }
}

#[test]
fn a_rejected_mutation_leaves_the_config_file_untouched() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");
  let original = "version: 0.10.3\n\nfiles:\n  include: &patterns\n    - \"a.erb\"\n  exclude: *patterns\n";

  fs::write(&config_path, original).unwrap();

  let mutation: HerbConfigOptions = serde_yaml::from_str("files:\n  include:\n    - \"b.erb\"\n").unwrap();

  if mutate_config_file(&config_path, &mutation, None).is_err() {
    assert_eq!(fs::read_to_string(&config_path).unwrap(), original);
  }

  serde_yaml::from_str::<serde_yaml::Value>(&fs::read_to_string(&config_path).unwrap()).expect("config file must still load");
}
