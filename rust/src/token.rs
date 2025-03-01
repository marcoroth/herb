use crate::location::Location;
use crate::range::Range;

#[derive(Debug, Clone)]
pub enum TokenType {
  Whitespace,
  NBSP,
  Newline,
  Identifier,
  HTMLDoctype,
  HTMLTagStart,
  HTMLTagEnd,
  HTMLTagStartClose,
  HTMLTagSelfClose,
  HTMLCommentStart,
  HTMLCommentEnd,
  Equals,
  Quote,
  Dash,
  Underscore,
  Exclamation,
  Slash,
  Semicolon,
  Colon,
  LT,
  Percent,
  Ampersand,
  ERBStart,
  ERBContent,
  ERBEnd,
  Character,
  Error,
  EOF,
}

pub struct Token {
  pub token_type: TokenType,
  pub value: String,
  pub start: Location,
  pub end: Location,
  pub range: Range,
}

impl Token {
  pub fn new(token_type: TokenType, value: String, start: Location, end: Location, range: Range) -> Self {
    Self { token_type, value, start, end, range }
  }

  pub fn copy(&self) -> Self {
    Self {
      token_type: self.token_type.clone(),
      value: self.value.clone(),
      start: self.start.copy(),
      end: self.end.copy(),
      range: self.range.copy(),
    }
  }

  pub fn to_string(&self) -> String {
    format!(
      "#<Token type={:?} value={:?} range={} start={} end={}>",
      self.token_type,
      self.value,
      self.range.to_string(),
      self.start.to_string(),
      self.end.to_string(),
    )
  }
}
