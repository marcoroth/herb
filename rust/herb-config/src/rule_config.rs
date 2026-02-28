use serde::{Deserialize, Serialize};

use crate::Severity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleConfig {
  #[serde(default = "default_enabled")]
  pub enabled: bool,
  #[serde(default)]
  pub severity: Option<Severity>,
  #[serde(default)]
  pub include: Vec<String>,
  #[serde(default)]
  pub only: Vec<String>,
  #[serde(default)]
  pub exclude: Vec<String>,
}

pub(crate) fn default_enabled() -> bool {
  true
}

impl Default for RuleConfig {
  fn default() -> Self {
    Self {
      enabled: true,
      severity: None,
      include: Vec::new(),
      only: Vec::new(),
      exclude: Vec::new(),
    }
  }
}
