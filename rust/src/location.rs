use crate::position::Position;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Location {
  pub start: Position,
  pub end: Position,
}

impl Location {
  pub fn new(start: Position, end: Position) -> Self {
    Self { start, end }
  }

  pub fn from(start_line: u32, start_column: u32, end_line: u32, end_column: u32) -> Self {
    Self {
      start: Position::new(start_line, start_column),
      end: Position::new(end_line, end_column),
    }
  }

  pub fn inspect(&self) -> String {
    format!("{}-{}", self.start, self.end)
  }
}

impl fmt::Display for Location {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
