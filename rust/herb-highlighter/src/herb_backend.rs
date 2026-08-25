use herb::Token;

pub trait HerbBackend: Send + Sync {
  fn lex(&self, source: &str) -> Result<Vec<Token>, String>;

  fn version(&self) -> String {
    herb::version()
  }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Herb;

impl HerbBackend for Herb {
  fn lex(&self, source: &str) -> Result<Vec<Token>, String> {
    herb::lex(source).map(|result| result.tokens)
  }
}
