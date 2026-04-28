use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::glob::is_path_matching;
use crate::{RuleConfig, Severity};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LinterConfig {
  #[serde(default)]
  pub rules: HashMap<String, RuleConfig>,
}

fn normalize_file_path(file_path: &str, project_path: Option<&str>) -> String {
  if let Some(project) = project_path {
    let path = Path::new(file_path);

    if path.is_absolute() {
      let project_prefix = if project.ends_with(std::path::MAIN_SEPARATOR) {
        project.to_string()
      } else {
        format!("{}{}", project, std::path::MAIN_SEPARATOR)
      };

      if file_path.starts_with(&project_prefix) {
        return file_path[project_prefix.len()..].to_string();
      }
    }
  }

  file_path.to_string()
}

impl LinterConfig {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn get_rule_config(&self, rule_name: &str) -> Option<&RuleConfig> {
    self.rules.get(rule_name)
  }

  pub fn is_rule_enabled(&self, rule_name: &str, default_enabled: bool) -> bool {
    match self.rules.get(rule_name) {
      Some(config) => config.enabled,
      None => default_enabled,
    }
  }

  pub fn get_severity(&self, rule_name: &str, default_severity: Severity) -> Severity {
    match self.rules.get(rule_name) {
      Some(config) => config.severity.unwrap_or(default_severity),
      None => default_severity,
    }
  }

  pub fn is_rule_enabled_for_path(&self, rule_name: &str, file_path: &str, default_exclude: &[&str]) -> bool {
    self.is_rule_enabled_for_path_with_project(rule_name, file_path, default_exclude, None)
  }

  pub fn is_rule_enabled_for_path_with_project(&self, rule_name: &str, file_path: &str, default_exclude: &[&str], project_path: Option<&str>) -> bool {
    let normalized = normalize_file_path(file_path, project_path);
    let file_path = normalized.as_str();

    if let Some(config) = self.rules.get(rule_name) {
      if !config.only.is_empty() {
        if !is_path_matching(file_path, &config.only) {
          return false;
        }

        return !is_path_matching(file_path, &config.exclude);
      }

      if !config.include.is_empty() {
        if !is_path_matching(file_path, &config.include) {
          return false;
        }

        return !is_path_matching(file_path, &config.exclude);
      }

      if is_path_matching(file_path, &config.exclude) {
        return false;
      }
    }

    let has_user_exclude = self.rules.get(rule_name).map(|c| !c.exclude.is_empty()).unwrap_or(false);

    if !has_user_exclude && !default_exclude.is_empty() && is_path_matching(file_path, default_exclude) {
      return false;
    }

    true
  }
}
