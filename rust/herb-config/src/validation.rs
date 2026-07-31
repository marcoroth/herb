use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::config_schema::HerbConfig;
use crate::defaults::DEFAULT_VERSION;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValidationSeverity {
  Error,
  Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConfigValidationError {
  pub message: String,
  pub path: Vec<String>,
  pub code: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub severity: Option<ValidationSeverity>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub line: Option<usize>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub column: Option<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct ValidateOptions<'options> {
  pub version: Option<&'options str>,
  pub project_path: Option<&'options Path>,
}

pub fn validate_config_text(text: &str, options: &ValidateOptions) -> Vec<ConfigValidationError> {
  let mut errors = Vec::new();

  if let Some(project_path) = options.project_path {
    if project_path.join(".herb.yaml").exists() {
      errors.push(ConfigValidationError {
        message: "Found .herb.yaml file. Please rename to .herb.yml".to_string(),
        path: Vec::new(),
        code: "wrong_file_extension".to_string(),
        severity: Some(ValidationSeverity::Warning),
        line: Some(0),
        column: Some(0),
      });
    }
  }

  let mut parsed: serde_yaml::Value = match serde_yaml::from_str(text) {
    Ok(parsed) => parsed,

    Err(error) => {
      let location = error.location();

      errors.push(ConfigValidationError {
        message: error.to_string(),
        path: Vec::new(),
        code: "yaml_syntax_error".to_string(),
        severity: Some(ValidationSeverity::Error),
        line: location.as_ref().map(|location| location.line().saturating_sub(1)),
        column: location.as_ref().map(|location| location.column().saturating_sub(1)),
      });

      return errors;
    }
  };

  if parsed.is_null() {
    parsed = serde_yaml::Value::Mapping(Default::default());
  }

  let version = options.version.unwrap_or(DEFAULT_VERSION);
  let declared_version = parsed.get("version").and_then(|value| value.as_str()).map(String::from);

  if let Some(declared_version) = &declared_version {
    if declared_version != version {
      errors.push(ConfigValidationError {
        message: format!(
          "Configuration version ({}) doesn't match current version ({}). Consider updating your configuration.",
          declared_version, version
        ),
        path: vec!["version".to_string()],
        code: "version_mismatch".to_string(),
        severity: Some(ValidationSeverity::Warning),
        line: None,
        column: None,
      });
    }
  }

  if declared_version.is_none() {
    if let Some(mapping) = parsed.as_mapping_mut() {
      mapping.insert(serde_yaml::Value::String("version".to_string()), serde_yaml::Value::String(version.to_string()));
    }
  }

  if let Err(error) = serde_yaml::from_value::<HerbConfig>(parsed) {
    let location = error.location();

    errors.push(ConfigValidationError {
      message: error.to_string(),
      path: Vec::new(),
      code: "invalid_type".to_string(),
      severity: Some(ValidationSeverity::Error),
      line: location.as_ref().map(|location| location.line().saturating_sub(1)),
      column: location.as_ref().map(|location| location.column().saturating_sub(1)),
    });
  }

  errors
}
