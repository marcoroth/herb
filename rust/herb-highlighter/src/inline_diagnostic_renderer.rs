use crate::ansi_sink::{AnsiSink, AnsiSinkOptions};
use crate::diagnostic::Diagnostic;
use crate::document_builder::DocumentBuilder;
use crate::file_renderer::RenderOptions;
use crate::syntax_renderer::SyntaxRenderer;

pub type CodeUrlBuilder<'a> = &'a dyn Fn(&str) -> String;

pub struct InlineDiagnosticRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> InlineDiagnosticRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  pub fn render(&self, path: &str, content: &str, diagnostics: &[Diagnostic], options: &RenderOptions, code_url_builder: Option<CodeUrlBuilder<'_>>) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_inline(path, content, diagnostics, code_url_builder);

    AnsiSink::new(self.syntax_renderer).render(
      &document,
      &AnsiSinkOptions {
        show_line_numbers: options.show_line_numbers,
        wrap_lines: options.wrap_lines,
        truncate_lines: options.truncate_lines,
        max_width: options.max_width,
        ..Default::default()
      },
    )
  }
}
