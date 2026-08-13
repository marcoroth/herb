//! `DiagnosticRenderOptions` and `DiffRenderOptions` deserialize straight from JSON, so the C
//! surface takes them as-is and there is one definition of each option.
//!
//! `HighlightOptions` cannot: it borrows its diagnostics and carries the URL-builder closures, so
//! it needs an owned counterpart to deserialize into. Everything here mirrors that one struct.

use serde::Deserialize;

use herb_highlighter::{Diagnostic, HighlightOptions};

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct HighlightOptionsInput {
  pub diagnostics: Vec<Diagnostic>,
  pub split_diagnostics: bool,
  pub context_lines: usize,
  pub focus_line: Option<usize>,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
}

impl Default for HighlightOptionsInput {
  fn default() -> Self {
    let defaults = HighlightOptions::default();

    Self {
      diagnostics: Vec::new(),
      split_diagnostics: defaults.split_diagnostics,
      context_lines: defaults.context_lines,
      focus_line: defaults.focus_line,
      show_line_numbers: defaults.show_line_numbers,
      wrap_lines: defaults.wrap_lines,
      max_width: defaults.max_width,
      truncate_lines: defaults.truncate_lines,
    }
  }
}

impl HighlightOptionsInput {
  pub fn to_options(&self) -> HighlightOptions<'_> {
    HighlightOptions {
      diagnostics: &self.diagnostics,
      split_diagnostics: self.split_diagnostics,
      context_lines: self.context_lines,
      focus_line: self.focus_line,
      show_line_numbers: self.show_line_numbers,
      wrap_lines: self.wrap_lines,
      max_width: self.max_width,
      truncate_lines: self.truncate_lines,
      code_url_builder: None,
      file_url_builder: None,
      suffix_builder: None,
    }
  }
}
