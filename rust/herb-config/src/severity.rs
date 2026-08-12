use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
  Error,
  Warning,
  Info,
  Hint,
}

impl Severity {
  pub fn as_str(&self) -> &'static str {
    match self {
      Severity::Error => "error",
      Severity::Warning => "warning",
      Severity::Info => "info",
      Severity::Hint => "hint",
    }
  }
}

impl std::fmt::Display for Severity {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(formatter, "{}", self.as_str())
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SeverityConfig {
  Severity(Severity),
  PerMode { editor: Severity, cli: Severity },
}

impl From<Severity> for SeverityConfig {
  fn from(severity: Severity) -> Self {
    SeverityConfig::Severity(severity)
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LinterMode {
  Editor,
  #[default]
  Cli,
}

pub fn resolve_severity(severity: SeverityConfig, mode: LinterMode) -> Severity {
  match severity {
    SeverityConfig::Severity(severity) => severity,

    SeverityConfig::PerMode { editor, cli } => match mode {
      LinterMode::Editor => editor,
      LinterMode::Cli => cli,
    },
  }
}
