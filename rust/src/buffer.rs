#[derive(Debug, Clone)]
pub struct Buffer {
  value: String,
  capacity: usize,
}

impl Buffer {
  pub fn new() -> Self {
    Self {
      value: String::with_capacity(1024),
      capacity: 1024,
    }
  }

  pub fn value(&self) -> &str {
    &self.value
  }

  pub fn length(&self) -> usize {
    self.value.len()
  }

  pub fn capacity(&self) -> usize {
    self.capacity
  }

  pub fn increase_capacity(&mut self, required_length: usize) -> bool {
    let required_capacity = self.length() + required_length;
    if self.capacity >= required_capacity {
      return true;
    }

    let new_capacity = required_capacity * 2;
    self.value.reserve(new_capacity - self.capacity);
    self.capacity = new_capacity;
    true
  }

  pub fn append(&mut self, text: &str) {
    if text.is_empty() {
      return;
    }
    if !self.increase_capacity(text.len()) {
      return;
    }
    self.value.push_str(text);
  }

  pub fn append_char(&mut self, character: char) {
    self.append(&character.to_string());
  }

  pub fn append_repeated(&mut self, character: char, length: usize) {
    if length == 0 {
      return;
    }
    self.append(&character.to_string().repeat(length));
  }

  pub fn append_whitespace(&mut self, length: usize) {
    self.append_repeated(' ', length);
  }

  pub fn prepend(&mut self, text: &str) {
    if text.is_empty() {
      return;
    }
    if !self.increase_capacity(text.len()) {
      return;
    }
    self.value.insert_str(0, text);
  }

  pub fn concat(&mut self, source: &Buffer) {
    if source.length() == 0 {
      return;
    }
    self.append(&source.value);
  }

  pub fn reserve(&mut self, min_capacity: usize) -> bool {
    let required_length = min_capacity.saturating_sub(self.length());
    self.increase_capacity(required_length)
  }

  pub fn clear(&mut self) {
    self.value.clear();
  }
}
