use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Position {
  pub line: u32,
  pub column: u32,
}

impl Position {
  pub fn new(line: u32, column: u32) -> Self {
    Self { line, column }
  }

  pub fn inspect(&self) -> String {
    format!("({}:{})", self.line, self.column)
  }
}

impl fmt::Display for Position {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
