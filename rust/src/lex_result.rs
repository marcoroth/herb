use crate::Token;

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
}
