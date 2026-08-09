use crate::ansi_sink::{AnsiSink, AnsiSinkOptions};
use crate::diff_computer::DiffHunk;
use crate::document::Document;
use crate::document_builder::{DiffDocumentOptions, DocumentBuilder};
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::themes::ColorScheme;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RemovedLineStyle {
  #[default]
  Tint,
  Dim,
  None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SingleLineStyle {
  #[default]
  Split,
  Inline,
  Auto,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DiffLayout {
  #[default]
  Unified,
  Split,
}

#[derive(Debug, Clone)]
pub struct DiffRenderOptions {
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub highlight_inline_changes: bool,
  pub removed_line_style: RemovedLineStyle,
  pub single_line_style: SingleLineStyle,
  pub layout: DiffLayout,
  pub indent: String,
}

impl Default for DiffRenderOptions {
  fn default() -> Self {
    Self {
      context_lines: 2,
      show_line_numbers: true,
      wrap_lines: true,
      max_width: None,
      truncate_lines: false,
      highlight_inline_changes: true,
      removed_line_style: RemovedLineStyle::Tint,
      single_line_style: SingleLineStyle::Split,
      layout: DiffLayout::Unified,
      indent: String::new(),
    }
  }
}

pub struct DiffRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> DiffRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer, _colors: ColorScheme) -> Self {
    Self { syntax_renderer }
  }

  pub fn render(&self, path: &str, original: &str, modified: &str, options: &DiffRenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_diff(path, original, modified, &document_options(options));

    self.render_document(&document, options)
  }

  pub fn render_from_hunks(&self, path: &str, hunks: &[DiffHunk], options: &DiffRenderOptions) -> String {
    let document = DocumentBuilder::new(self.syntax_renderer).build_diff_from_hunks(path, hunks, &document_options(options));

    self.render_document(&document, options)
  }

  fn render_document(&self, document: &Document, options: &DiffRenderOptions) -> String {
    AnsiSink::new(self.syntax_renderer).render(
      document,
      &AnsiSinkOptions {
        show_line_numbers: options.show_line_numbers,
        wrap_lines: options.wrap_lines,
        truncate_lines: options.truncate_lines,
        max_width: options.max_width.unwrap_or_else(LineWrapper::get_terminal_width),
        removed_line_style: options.removed_line_style,
        single_line_style: options.single_line_style,
        layout: options.layout,
        indent: options.indent.clone(),
      },
    )
  }
}

fn document_options(options: &DiffRenderOptions) -> DiffDocumentOptions {
  DiffDocumentOptions {
    context_lines: options.context_lines,
    highlight_inline_changes: options.highlight_inline_changes,
  }
}
