use std::fs;

use herb_config::{validate_config_text, ValidateOptions, ValidationSeverity};

#[test]
fn validate_config_text_accepts_a_valid_config() {
  let text = format!("version: {}\nlinter:\n  enabled: true\n", herb_config::DEFAULT_VERSION);

  assert!(validate_config_text(&text, &ValidateOptions::default()).is_empty());
}

#[test]
fn validate_config_text_reports_yaml_syntax_errors_with_a_position() {
  let errors = validate_config_text("linter:\n\tenabled: true\n", &ValidateOptions::default());

  assert_eq!(errors.len(), 1);
  assert_eq!(errors[0].code, "yaml_syntax_error");
  assert_eq!(errors[0].severity, Some(ValidationSeverity::Error));
  assert!(errors[0].line.is_some());
}

#[test]
fn validate_config_text_reports_unknown_keys() {
  let errors = validate_config_text("linter:\n  notARealKey: true\n", &ValidateOptions::default());

  assert!(!errors.is_empty());
  assert!(errors.iter().any(|error| error.message.contains("notARealKey")));
}

#[test]
fn validate_config_text_warns_on_a_version_mismatch() {
  let errors = validate_config_text("version: 0.1.0\n", &ValidateOptions::default());

  let mismatch = errors
    .iter()
    .find(|error| error.code == "version_mismatch")
    .expect("expected a version_mismatch");

  assert_eq!(mismatch.severity, Some(ValidationSeverity::Warning));
  assert_eq!(mismatch.path, vec!["version".to_string()]);
}

#[test]
fn validate_config_text_warns_about_a_stray_herb_yaml() {
  let dir = tempfile::tempdir().unwrap();

  fs::write(dir.path().join(".herb.yaml"), "version: 0.10.2\n").unwrap();

  let errors = validate_config_text(
    "version: 0.10.2\n",
    &ValidateOptions {
      version: Some("0.10.2"),
      project_path: Some(dir.path()),
    },
  );

  assert!(errors.iter().any(|error| error.code == "wrong_file_extension"));
}
