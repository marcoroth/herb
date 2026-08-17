#[derive(Default)]
pub struct PrintContext {
  output: String,
  indent_level: usize,
  current_column: usize,
  preserve_stack: Vec<String>,
}

impl PrintContext {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn write(&mut self, text: &str) {
    self.output.push_str(text);
    self.current_column += text.chars().count();
  }

  pub fn write_with_column_tracking(&mut self, text: &str) {
    self.output.push_str(text);

    let mut lines = text.rsplit('\n');
    let last = lines.next().unwrap_or("");

    if text.contains('\n') {
      self.current_column = last.chars().count();
    } else {
      self.current_column += text.chars().count();
    }
  }

  pub fn indent(&mut self) {
    self.indent_level += 1;
  }

  pub fn dedent(&mut self) {
    if self.indent_level > 0 {
      self.indent_level -= 1;
    }
  }

  pub fn enter_tag(&mut self, tag_name: &str) {
    self.preserve_stack.push(tag_name.to_lowercase());
  }

  pub fn exit_tag(&mut self) {
    self.preserve_stack.pop();
  }

  pub fn is_at_start_of_line(&self) -> bool {
    self.current_column == 0
  }

  pub fn current_indent_level(&self) -> usize {
    self.indent_level
  }

  pub fn current_column(&self) -> usize {
    self.current_column
  }

  pub fn tag_stack(&self) -> &[String] {
    &self.preserve_stack
  }

  pub fn output(&self) -> &str {
    &self.output
  }

  pub fn reset(&mut self) {
    self.output.clear();
    self.indent_level = 0;
    self.current_column = 0;
    self.preserve_stack.clear();
  }
}
