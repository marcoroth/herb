pub struct ParseResult {
  pub tree_inspect: String,
}

impl ParseResult {
  pub fn new(tree_inspect: String) -> Self {
    Self { tree_inspect }
  }

  pub fn tree_inspect(&self) -> &str {
    &self.tree_inspect
  }
}
