use serde::{Deserialize, Serialize};

pub(crate) fn default_indent_width() -> usize {
  2
}

pub(crate) fn default_max_line_length() -> usize {
  80
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatterConfig {
  #[serde(default = "default_indent_width")]
  pub indent_width: usize,
  #[serde(default = "default_max_line_length")]
  pub max_line_length: usize,
}

impl Default for FormatterConfig {
  fn default() -> Self {
    Self {
      indent_width: default_indent_width(),
      max_line_length: default_max_line_length(),
    }
  }
}

impl FormatterConfig {
  pub fn new() -> Self {
    Self::default()
  }
}
