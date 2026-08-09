use crate::ansi_sink::{AnsiSink, AnsiSinkOptions};
use crate::diagnostic::Diagnostic;
use crate::document_builder::{CardOptions, DocumentBuilder};
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;

#[derive(Debug, Clone)]
pub struct DiagnosticRenderOptions {
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub optimize_highlighting: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub code_url: Option<String>,
  pub file_url: Option<String>,
  pub suffix: Option<String>,
}

impl Default for DiagnosticRenderOptions {
  fn default() -> Self {
    Self {
      context_lines: 2,
      show_line_numbers: true,
      optimize_highlighting: true,
      wrap_lines: true,
      max_width: None,
      truncate_lines: false,
      code_url: None,
      file_url: None,
      suffix: None,
    }
  }
}

pub struct DiagnosticRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> DiagnosticRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  pub fn render_single(&self, path: &str, diagnostic: &Diagnostic, content: &str, options: &DiagnosticRenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_card(
      path,
      diagnostic,
      content,
      &CardOptions {
        context_lines: options.context_lines,
        optimize_highlighting: options.optimize_highlighting,
        code_url: options.code_url.clone(),
        file_url: options.file_url.clone(),
        suffix: options.suffix.clone(),
      },
    );

    AnsiSink::new(self.syntax_renderer).render(
      &document,
      &AnsiSinkOptions {
        show_line_numbers: options.show_line_numbers,
        wrap_lines: options.wrap_lines,
        truncate_lines: options.truncate_lines,
        max_width: options.max_width.unwrap_or_else(LineWrapper::get_terminal_width),
      },
    )
  }
}
