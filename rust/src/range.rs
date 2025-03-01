pub struct Range {
  pub start: usize,
  pub end: usize,
}

impl Range {
  pub fn new(start: usize, end: usize) -> Self {
    Self { start, end }
  }

  pub fn length(&self) -> usize {
    self.end.saturating_sub(self.start)
  }

  pub fn copy(&self) -> Self {
    Self { start: self.start, end: self.end }
  }

  pub fn to_string(&self) -> String {
    format!(
      "#<Range [{}, {}]>",
      self.start,
      self.end,
    )
  }
}
