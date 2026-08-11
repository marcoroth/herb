use serde::{Deserialize, Serialize};
use std::fmt;

pub const DIAGNOSTIC_SEVERITIES: [DiagnosticSeverity; 4] = [
  DiagnosticSeverity::Error,
  DiagnosticSeverity::Warning,
  DiagnosticSeverity::Info,
  DiagnosticSeverity::Hint,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
  Error,
  Warning,
  Info,
  Hint,
}

impl DiagnosticSeverity {
  pub fn as_str(&self) -> &'static str {
    match self {
      DiagnosticSeverity::Error => "error",
      DiagnosticSeverity::Warning => "warning",
      DiagnosticSeverity::Info => "info",
      DiagnosticSeverity::Hint => "hint",
    }
  }

  pub fn order(&self) -> usize {
    DIAGNOSTIC_SEVERITIES
      .iter()
      .position(|severity| severity == self)
      .unwrap_or(DIAGNOSTIC_SEVERITIES.len())
  }
}

impl fmt::Display for DiagnosticSeverity {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str(self.as_str())
  }
}

pub fn is_diagnostic_severity(value: &str) -> bool {
  DIAGNOSTIC_SEVERITIES.iter().any(|severity| severity.as_str() == value)
}

pub fn meets_severity_threshold(severity: DiagnosticSeverity, threshold: DiagnosticSeverity) -> bool {
  severity.order() <= threshold.order()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticTag {
  Unnecessary,
  Deprecated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SerializedPosition {
  pub line: usize,
  pub column: usize,
}

impl SerializedPosition {
  pub fn new(line: usize, column: usize) -> Self {
    Self { line, column }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SerializedLocation {
  pub start: SerializedPosition,
  pub end: SerializedPosition,
}

impl SerializedLocation {
  pub fn new(start: SerializedPosition, end: SerializedPosition) -> Self {
    Self { start, end }
  }

  pub fn from(start_line: usize, start_column: usize, end_line: usize, end_column: usize) -> Self {
    Self {
      start: SerializedPosition::new(start_line, start_column),
      end: SerializedPosition::new(end_line, end_column),
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
  pub message: String,
  pub location: SerializedLocation,
  pub severity: DiagnosticSeverity,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub code: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub source: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub tags: Option<Vec<DiagnosticTag>>,
}

impl Diagnostic {
  pub fn new(message: impl Into<String>, location: SerializedLocation, severity: DiagnosticSeverity) -> Self {
    Self {
      message: message.into(),
      location,
      severity,
      code: None,
      source: None,
      tags: None,
    }
  }

  pub fn with_code(mut self, code: impl Into<String>) -> Self {
    self.code = Some(code.into());

    self
  }
}
