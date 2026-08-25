#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NamedReference {
  pub name: String,
  pub start_offset: usize,
  pub length: usize,
}

impl NamedReference {
  pub fn new(name: impl Into<String>, start_offset: usize, length: usize) -> Self {
    Self {
      name: name.into(),
      start_offset,
      length,
    }
  }
}
