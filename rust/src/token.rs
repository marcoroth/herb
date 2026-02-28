use crate::location::Location;
use crate::range::Range;
use colored::*;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
  pub token_type: String,
  pub value: String,
  pub location: Location,
  pub range: Range,
}

impl Token {
  pub fn new(token_type: String, value: String, location: Location, range: Range) -> Self {
    Self {
      token_type,
      value,
      location,
      range,
    }
  }

  pub fn inspect(&self) -> String {
    let display_value = if self.token_type == "TOKEN_EOF" && self.value.is_empty() {
      "<EOF>".to_string()
    } else {
      self.escaped_value()
    };

    format!(
      "#<Herb::Token type=\"{}\" value=\"{}\" range={} start={} end={}>",
      self.token_type,
      display_value,
      self.range.inspect(),
      self.location.start.inspect(),
      self.location.end.inspect()
    )
  }

  fn escaped_value(&self) -> String {
    self
      .value
      .replace('\\', "\\\\")
      .replace('\n', "\\n")
      .replace('\r', "\\r")
      .replace('\t', "\\t")
      .replace('"', "\\\"")
  }

  pub fn tree_inspect(&self) -> String {
    format!(
      "{} {}",
      format!("\"{}\"", self.escaped_value()).green(),
      format!("(location: {})", self.location).dimmed()
    )
  }
}

impl fmt::Display for Token {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "Token{{type='{}', value='{}', location={}}}", self.token_type, self.value, self.location)
  }
}
