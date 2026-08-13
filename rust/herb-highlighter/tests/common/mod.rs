#![allow(dead_code)]

use std::sync::Arc;

use herb::{Location, Range, Token};
use herb_highlighter::ansi::strip_ansi;
use herb_highlighter::color::{set_color_override, set_terminal_override};
use herb_highlighter::herb_backend::HerbBackend;

pub fn with_color() {
  set_color_override(true);
}

pub fn no_color() {
  set_color_override(false);
}

pub fn with_terminal() {
  set_terminal_override(true);
}

pub fn without_terminal() {
  set_terminal_override(false);
}

pub fn strip_ansi_colors(text: &str) -> String {
  strip_ansi(text)
}

pub struct StubBackend {
  tokens: Vec<Token>,
  fails: bool,
}

impl StubBackend {
  pub fn with_tokens(tokens: Vec<Token>) -> Arc<dyn HerbBackend> {
    Arc::new(Self { tokens, fails: false })
  }

  pub fn failing() -> Arc<dyn HerbBackend> {
    Arc::new(Self {
      tokens: Vec::new(),
      fails: true,
    })
  }
}

impl HerbBackend for StubBackend {
  fn lex(&self, _source: &str) -> Result<Vec<Token>, String> {
    if self.fails {
      return Err("error".to_string());
    }

    Ok(self.tokens.clone())
  }
}

pub fn token(token_type: &str, from: usize, to: usize) -> Token {
  Token::new(token_type.to_string(), String::new(), Location::from(0, 0, 0, 0), Range::new(from, to))
}
