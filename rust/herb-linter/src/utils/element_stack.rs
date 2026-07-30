pub struct ElementStack {
  stack: Vec<Option<String>>,
}

impl ElementStack {
  pub fn new() -> Self {
    Self { stack: Vec::new() }
  }

  pub fn push(&mut self, tag_name: String) {
    self.stack.push(Some(tag_name));
  }

  pub fn push_optional(&mut self, tag_name: Option<String>) {
    self.stack.push(tag_name);
  }

  pub fn pop(&mut self) {
    self.stack.pop();
  }

  pub fn inside(&self, tag_name: &str) -> bool {
    self.inside_any(&[tag_name])
  }

  pub fn inside_any(&self, tag_names: &[&str]) -> bool {
    self
      .stack
      .iter()
      .any(|tag| tag.as_deref().map(|name| tag_names.contains(&name)).unwrap_or(false))
  }

  pub fn current_tag_name(&self) -> Option<&str> {
    self.stack.last().and_then(|tag| tag.as_deref())
  }

  pub fn ancestors(&self) -> impl Iterator<Item = &str> {
    self.stack.iter().filter_map(|tag| tag.as_deref())
  }

  pub fn parent_tag_name(&self) -> Option<&str> {
    let length = self.stack.len();

    if length < 2 {
      return None;
    }

    self.stack[length - 2].as_deref()
  }
}

impl Default for ElementStack {
  fn default() -> Self {
    Self::new()
  }
}
