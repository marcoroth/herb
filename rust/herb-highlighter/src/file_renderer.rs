use crate::ansi_sink::{AnsiSink, AnsiSinkOptions};
use crate::document_builder::DocumentBuilder;
use crate::syntax_renderer::SyntaxRenderer;

#[derive(Debug, Clone, Copy)]
pub struct RenderOptions {
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: usize,
  pub truncate_lines: bool,
}

pub struct FileRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> FileRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  fn sink_options(show_line_numbers: bool, options: &RenderOptions) -> AnsiSinkOptions {
    AnsiSinkOptions {
      show_line_numbers,
      wrap_lines: options.wrap_lines,
      truncate_lines: options.truncate_lines,
      max_width: options.max_width,
      ..Default::default()
    }
  }

  pub fn render_with_line_numbers(&self, path: &str, content: &str, options: &RenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_file(path, content);

    AnsiSink::new(self.syntax_renderer).render(&document, &Self::sink_options(true, options))
  }

  pub fn render_with_focus_line(&self, path: &str, content: &str, focus_line: usize, context_lines: usize, options: &RenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_focus(path, content, focus_line, context_lines);

    AnsiSink::new(self.syntax_renderer).render(&document, &Self::sink_options(options.show_line_numbers, options))
  }

  pub fn render_plain(&self, content: &str, options: &RenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_plain(content);

    AnsiSink::new(self.syntax_renderer).render(&document, &Self::sink_options(false, options))
  }
}
