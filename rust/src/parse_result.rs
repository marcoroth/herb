use crate::errors::{AnyError, ErrorNode};
use crate::herb::ParserOptions;
use crate::nodes::{DocumentNode, Node};
use std::fmt;

pub struct ParseResult {
  pub value: DocumentNode,
  pub source: String,
  pub errors: Vec<AnyError>,
  pub options: ParserOptions,
}

impl ParseResult {
  pub fn new(value: DocumentNode, source: String, errors: Vec<AnyError>, options: &ParserOptions) -> Self {
    Self {
      value,
      source,
      errors,
      options: options.clone(),
    }
  }

  pub fn inspect(&self) -> String {
    self.value.tree_inspect()
  }

  pub fn errors(&self) -> &[AnyError] {
    &self.errors
  }

  pub fn recursive_errors(&self) -> Vec<&dyn ErrorNode> {
    let mut all_errors: Vec<&dyn ErrorNode> = Vec::new();
    all_errors.extend(self.errors.iter().map(|e| e as &dyn ErrorNode));
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

impl fmt::Display for ParseResult {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.inspect())
  }
}
