use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Range {
  pub from: usize,
  pub to: usize,
}

impl Range {
  pub fn new(from: usize, to: usize) -> Self {
    Self { from, to }
  }

  pub fn length(&self) -> usize {
    self.to - self.from
  }

  pub fn inspect(&self) -> String {
    format!("[{}, {}]", self.from, self.to)
  }
}

impl fmt::Display for Range {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
