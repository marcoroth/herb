pub struct ElementStack {
  stack: Vec<String>,
}

impl ElementStack {
  pub fn new() -> Self {
    Self { stack: Vec::new() }
  }

  pub fn push(&mut self, tag_name: String) {
    self.stack.push(tag_name);
  }

  pub fn pop(&mut self) {
    self.stack.pop();
  }

  pub fn inside(&self, tag_name: &str) -> bool {
    self.stack.iter().any(|tag| tag == tag_name)
  }
}
