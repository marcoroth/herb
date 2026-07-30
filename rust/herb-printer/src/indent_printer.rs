use herb::nodes::DocumentNode;
use herb::Visitor;

use crate::print_context::PrintContext;
use crate::printer::Printer;
use crate::printing_visitor::impl_printing_visitor;

pub struct IndentPrinter {
  context: PrintContext,
  indent_level: usize,
  indent_width: usize,
  pending_indent: bool,
}

impl Default for IndentPrinter {
  fn default() -> Self {
    Self::new(2)
  }
}

impl IndentPrinter {
  pub fn new(indent_width: usize) -> Self {
    Self {
      context: PrintContext::new(),
      indent_level: 0,
      indent_width,
      pending_indent: false,
    }
  }

  pub fn print_document(document: &DocumentNode) -> String {
    Self::print_with_width(document, 2)
  }

  pub fn print_with_width(document: &DocumentNode, indent_width: usize) -> String {
    let mut printer = Self::new(indent_width);

    printer.visit_document_node(document);

    printer.context.output().to_string()
  }

  fn indentation(&self) -> String {
    " ".repeat(self.indent_level * self.indent_width)
  }
}

impl Printer for IndentPrinter {
  fn context(&mut self) -> &mut PrintContext {
    &mut self.context
  }

  fn context_ref(&self) -> &PrintContext {
    &self.context
  }

  fn enter_indent(&mut self) {
    self.indent_level += 1;
  }

  fn exit_indent(&mut self) {
    self.indent_level = self.indent_level.saturating_sub(1);
  }

  fn write(&mut self, content: &str) {
    if self.pending_indent && !content.is_empty() {
      self.pending_indent = false;

      let indentation = self.indentation();
      self.context.write(&indentation);
      self.context.write(content);
    } else {
      self.context.write(content);
    }
  }

  fn write_text(&mut self, content: &str) {
    if !content.contains('\n') {
      if self.pending_indent {
        self.pending_indent = false;

        let trimmed = content.trim_start_matches([' ', '\t']);

        if !trimmed.is_empty() {
          let indentation = self.indentation();
          self.context.write(&indentation);
          self.context.write(trimmed);
        }
      } else {
        self.context.write(content);
      }

      return;
    }

    let lines: Vec<&str> = content.split('\n').collect();
    let last_index = lines.len() - 1;

    for (index, line) in lines.iter().enumerate() {
      if index > 0 {
        self.context.write("\n");
      }

      let trimmed = line.trim_start_matches([' ', '\t']);

      if index == 0 {
        if self.pending_indent {
          self.pending_indent = false;

          if !trimmed.is_empty() {
            let indentation = self.indentation();
            self.context.write(&indentation);
            self.context.write(trimmed);
          }
        } else {
          self.context.write(line);
        }
      } else if index == last_index && trimmed.is_empty() {
        self.pending_indent = true;
      } else if trimmed.is_empty() {
        // middle whitespace-only line: the newline above is enough
      } else {
        let indentation = self.indentation();
        self.context.write(&indentation);
        self.context.write(trimmed);
      }
    }
  }
}

impl_printing_visitor!(IndentPrinter);
