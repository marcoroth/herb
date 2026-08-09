use std::sync::Arc;

use crate::ansi_sink::{AnsiSink, AnsiSinkOptions};
use crate::diagnostic::Diagnostic;
use crate::diagnostic_renderer::{DiagnosticRenderOptions, DiagnosticRenderer};
use crate::diff_computer::DiffHunk;
use crate::diff_renderer::{DiffRenderOptions, DiffRenderer};
use crate::document::Document;
use crate::document_builder::{DocumentBuilder, SplitOptions};
use crate::error::HighlightError;
use crate::herb_backend::{Herb, HerbBackend};
use crate::html_sink::{self, HTMLRenderOptions};
use crate::inline_diagnostic_renderer::CodeUrlBuilder;
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::themes::{resolve_theme, ColorScheme, DEFAULT_THEME};

pub type FileUrlBuilder<'a> = &'a dyn Fn(&str, &Diagnostic) -> String;

pub type SuffixBuilder<'a> = &'a dyn Fn(&Diagnostic) -> Option<String>;

pub struct HighlightOptions<'a> {
  pub diagnostics: &'a [Diagnostic],
  pub split_diagnostics: bool,

  pub context_lines: usize,
  pub focus_line: Option<usize>,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub code_url_builder: Option<CodeUrlBuilder<'a>>,
  pub file_url_builder: Option<FileUrlBuilder<'a>>,
  pub suffix_builder: Option<SuffixBuilder<'a>>,
}

impl Default for HighlightOptions<'_> {
  fn default() -> Self {
    Self {
      diagnostics: &[],
      split_diagnostics: false,
      context_lines: 0,
      focus_line: None,
      show_line_numbers: true,
      wrap_lines: true,
      max_width: None,
      truncate_lines: false,
      code_url_builder: None,
      file_url_builder: None,
      suffix_builder: None,
    }
  }
}

pub type HighlightDiagnosticOptions = DiagnosticRenderOptions;

pub struct Highlighter {
  colors: ColorScheme,
  syntax_renderer: SyntaxRenderer,
}

impl Highlighter {
  pub fn new(theme: &str) -> Result<Self, HighlightError> {
    Self::with_backend(theme, Arc::new(Herb))
  }

  pub fn with_backend(theme: &str, herb: Arc<dyn HerbBackend>) -> Result<Self, HighlightError> {
    let colors = resolve_theme(theme)?;

    Ok(Self {
      colors: colors.clone(),
      syntax_renderer: SyntaxRenderer::with_backend(colors, herb),
    })
  }

  pub fn highlight(&self, path: &str, content: &str, options: &HighlightOptions<'_>) -> String {
    let max_width = options.max_width.unwrap_or_else(LineWrapper::get_terminal_width);

    let sink_options = AnsiSinkOptions {
      show_line_numbers: options.show_line_numbers,
      wrap_lines: options.wrap_lines,
      truncate_lines: options.truncate_lines,
      max_width,
    };

    let document = self.build_document(path, content, options);

    AnsiSink::new(&self.syntax_renderer).render(&document, &sink_options)
  }

  pub fn build_document(&self, path: &str, content: &str, options: &HighlightOptions<'_>) -> Document {
    let builder = DocumentBuilder::new(&self.syntax_renderer);

    if !options.diagnostics.is_empty() && options.split_diagnostics {
      return builder.build_split(
        path,
        content,
        options.diagnostics,
        &SplitOptions {
          context_lines: options.context_lines,
          optimize_highlighting: true,
          code_url_builder: options.code_url_builder,
          file_url_builder: options.file_url_builder,
          suffix_builder: options.suffix_builder,
        },
      );
    }

    if !options.diagnostics.is_empty() {
      return builder.build_inline(path, content, options.diagnostics, options.code_url_builder);
    }

    if let Some(focus_line) = options.focus_line {
      return builder.build_focus(path, content, focus_line, options.context_lines);
    }

    if options.show_line_numbers {
      builder.build_file(path, content)
    } else {
      builder.build_plain(content)
    }
  }

  pub fn highlight_html(&self, path: &str, content: &str, options: &HTMLRenderOptions) -> String {
    let runs = self.syntax_renderer.highlight_runs(content);

    if let Some(focus_line) = options.focus_line {
      return html_sink::render_focus_html(&runs, path, focus_line, options.context_lines, options.show_line_numbers, &options.theme_label);
    }

    if options.show_line_numbers {
      html_sink::render_file_html(&runs, path, &options.theme_label)
    } else {
      html_sink::render_plain_html(&runs, &options.theme_label)
    }
  }

  pub fn highlight_diagnostic(&self, path: &str, diagnostic: &Diagnostic, content: &str, options: &HighlightDiagnosticOptions) -> String {
    DiagnosticRenderer::new(&self.syntax_renderer).render_single(path, diagnostic, content, options)
  }

  pub fn highlight_diff(&self, path: &str, original: &str, modified: &str, options: &DiffRenderOptions) -> String {
    DiffRenderer::new(&self.syntax_renderer, self.colors.clone()).render(path, original, modified, options)
  }

  pub fn highlight_diff_hunks(&self, path: &str, hunks: &[DiffHunk], options: &DiffRenderOptions) -> String {
    DiffRenderer::new(&self.syntax_renderer, self.colors.clone()).render_from_hunks(path, hunks, options)
  }

  pub fn highlight_file_from_path(&self, file_path: &str, options: &HighlightOptions<'_>) -> Result<String, HighlightError> {
    let content = read_file(file_path)?;

    Ok(self.highlight(file_path, &content, options))
  }

  pub fn highlight_diagnostic_from_path(
    &self,
    file_path: &str,
    diagnostic: &Diagnostic,
    options: &HighlightDiagnosticOptions,
  ) -> Result<String, HighlightError> {
    let content = read_file(file_path)?;

    Ok(self.highlight_diagnostic(file_path, diagnostic, &content, options))
  }
}

fn read_file(file_path: &str) -> Result<String, HighlightError> {
  std::fs::read_to_string(file_path).map_err(|error| HighlightError::new(format!("Failed to read file {file_path}: {error}")))
}

pub fn highlight_content(content: &str, theme: &str, options: &HighlightOptions<'_>) -> Result<String, HighlightError> {
  Highlighter::new(theme).map(|highlighter| highlighter.highlight("", content, options))
}

pub fn highlight_file(file_path: &str, theme: &str, options: &HighlightOptions<'_>) -> Result<String, HighlightError> {
  Highlighter::new(theme)?.highlight_file_from_path(file_path, options)
}

impl Default for Highlighter {
  fn default() -> Self {
    Self::new(DEFAULT_THEME.as_str()).expect("the default theme is bundled")
  }
}
