pub struct Location {
  pub line: usize,
  pub column: usize,
}

impl Location {
  pub fn new(line: usize, column: usize) -> Self {
    Self { line, column }
  }

  pub fn copy(&self) -> Self {
    Self { line: self.line, column: self.column }
  }

  pub fn to_string(&self) -> String {
    format!(
      "#<Location ({}:{})>",
      self.line,
      self.column,
    )
  }
}
