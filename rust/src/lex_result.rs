use crate::Token;
use std::fmt;

pub struct LexResult {
  pub tokens: Vec<Token>,
}

impl LexResult {
  pub fn new(tokens: Vec<Token>) -> Self {
    Self { tokens }
  }

  pub fn tokens(&self) -> &[Token] {
    &self.tokens
  }

  pub fn inspect(&self) -> String {
    self.tokens.iter().map(|token| token.inspect()).collect::<Vec<_>>().join("\n")
  }
}

impl fmt::Display for LexResult {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
