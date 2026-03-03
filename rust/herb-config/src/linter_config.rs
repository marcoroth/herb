use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::glob::is_path_matching;
use crate::{RuleConfig, Severity};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LinterConfig {
  #[serde(default)]
  pub rules: HashMap<String, RuleConfig>,
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
