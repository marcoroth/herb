use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HighlightError {
  pub message: String,
}

impl HighlightError {
  pub fn new(message: impl Into<String>) -> Self {
    Self { message: message.into() }
  }
}

impl fmt::Display for HighlightError {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str(&self.message)
  }
}

impl std::error::Error for HighlightError {}
