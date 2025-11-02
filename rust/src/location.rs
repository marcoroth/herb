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

  pub fn inspect(&self) -> String {
    format!("{}-{}", self.start, self.end)
  }
}

impl fmt::Display for Location {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
