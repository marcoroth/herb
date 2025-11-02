use crate::nodes::{DocumentNode, ErrorNode, Node};

pub struct ParseResult {
  pub value: DocumentNode,
  pub source: String,
  pub errors: Vec<ErrorNode>,
}

impl ParseResult {
  pub fn new(value: DocumentNode, source: String, errors: Vec<ErrorNode>) -> Self {
    Self {
      value,
      source,
      errors,
    }
  }

  pub fn tree_inspect(&self) -> String {
    self.value.tree_inspect()
  }

  pub fn errors(&self) -> &[ErrorNode] {
    &self.errors
  }

  pub fn recursive_errors(&self) -> Vec<ErrorNode> {
    let mut all_errors = self.errors.clone();
    all_errors.extend(self.value.recursive_errors());
    all_errors
  }

  pub fn failed(&self) -> bool {
    !self.recursive_errors().is_empty()
  }

  pub fn success(&self) -> bool {
    self.recursive_errors().is_empty()
  }
}
