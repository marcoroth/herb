use herb::Location;
use herb_config::Severity;

use serde::Serialize;

#[derive(Debug, Clone)]
pub struct UnboundOffense {
  pub rule: String,
  pub code: String,
  pub message: String,
  pub location: Location,
  pub severity: Option<Severity>,
  pub tags: Vec<String>,
  pub unsafe_fix: bool,
  pub autofixable: bool,
}

impl UnboundOffense {
  pub fn new(rule: &str, message: impl Into<String>, location: Location) -> Self {
    Self {
      rule: rule.to_string(),
      code: rule.to_string(),
      message: message.into(),
      location,
      severity: None,
      tags: Vec::new(),
      unsafe_fix: false,
      autofixable: true,
    }
  }

  pub fn with_severity(rule: &str, message: impl Into<String>, location: Location, severity: Severity) -> Self {
    Self {
      severity: Some(severity),
      ..Self::new(rule, message, location)
    }
  }

  pub fn with_tags(rule: &str, message: impl Into<String>, location: Location, tags: Vec<String>) -> Self {
    Self {
      tags,
      ..Self::new(rule, message, location)
    }
  }

  pub fn unsafe_fix(mut self) -> Self {
    self.unsafe_fix = true;
    self
  }

  pub fn not_autofixable(mut self) -> Self {
    self.autofixable = false;
    self
  }
}

#[derive(Debug, Clone, Serialize)]
pub struct Offense {
  pub rule: String,
  pub code: String,
  pub source: String,
  pub message: String,
  pub severity: Severity,
  pub location: OffenseLocation,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  pub tags: Vec<String>,
  #[serde(skip)]
  pub unsafe_fix: bool,
  #[serde(skip)]
  pub autofixable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct OffenseLocation {
  pub start: OffensePosition,
  pub end: OffensePosition,
}

#[derive(Debug, Clone, Serialize)]
pub struct OffensePosition {
  pub line: u32,
  pub column: u32,
}

impl From<&Location> for OffenseLocation {
  fn from(location: &Location) -> Self {
    Self {
      start: OffensePosition {
        line: location.start.line,
        column: location.start.column,
      },
      end: OffensePosition {
        line: location.end.line,
        column: location.end.column,
      },
    }
  }
}

#[derive(Debug, Clone, Serialize)]
pub struct LintResult {
  pub offenses: Vec<Offense>,
  pub errors: usize,
  pub warnings: usize,
  pub info: usize,
  pub hints: usize,
  pub ignored: usize,
  #[serde(skip_serializing_if = "is_zero")]
  pub would_be_ignored: usize,
}

fn is_zero(value: &usize) -> bool {
  *value == 0
}

impl LintResult {
  pub fn new(offenses: Vec<Offense>) -> Self {
    Self::new_with_ignored(offenses, 0)
  }

  pub fn new_with_ignored(offenses: Vec<Offense>, ignored: usize) -> Self {
    Self::new_with_counts(offenses, ignored, 0)
  }

  pub fn new_with_counts(offenses: Vec<Offense>, ignored: usize, would_be_ignored: usize) -> Self {
    let errors = offenses.iter().filter(|offense| offense.severity == Severity::Error).count();
    let warnings = offenses.iter().filter(|offense| offense.severity == Severity::Warning).count();
    let info = offenses.iter().filter(|offense| offense.severity == Severity::Info).count();
    let hints = offenses.iter().filter(|offense| offense.severity == Severity::Hint).count();

    Self {
      offenses,
      errors,
      warnings,
      info,
      hints,
      ignored,
      would_be_ignored,
    }
  }

  pub fn empty() -> Self {
    Self {
      offenses: Vec::new(),
      errors: 0,
      warnings: 0,
      info: 0,
      hints: 0,
      ignored: 0,
      would_be_ignored: 0,
    }
  }
}
