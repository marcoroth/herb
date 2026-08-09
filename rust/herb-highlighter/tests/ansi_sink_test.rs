mod common;

use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::highlighter::{HighlightDiagnosticOptions, HighlightOptions, Highlighter};

use common::with_color;

const PATH: &str = "app/views/users/show.html.erb";
const CONTENT: &str = "<div>\n  <%= user.name %>\n  <p>hello</p>\n  <span>world</span>\n</div>";

fn multi_line_diagnostic() -> Diagnostic {
  Diagnostic::new("unclosed `<%=` tag", SerializedLocation::from(2, 2, 3, 6), DiagnosticSeverity::Error).with_code("parser-error")
}

fn warning_diagnostic() -> Diagnostic {
  Diagnostic::new("avoid inline spans", SerializedLocation::from(4, 2, 4, 8), DiagnosticSeverity::Warning)
}

fn highlighter() -> Highlighter {
  Highlighter::new("onedark").expect("the theme resolves")
}

#[test]
fn renders_an_inline_document() {
  with_color();

  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let result = highlighter().highlight(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}

#[test]
fn renders_a_card_document() {
  with_color();

  let result = highlighter().highlight_diagnostic(
    PATH,
    &multi_line_diagnostic(),
    CONTENT,
    &HighlightDiagnosticOptions {
      context_lines: 1,
      code_url: Some("https://herb.tools/rules/parser-error".to_string()),
      file_url: Some("file:///app/views/show.html.erb".to_string()),
      suffix: Some("(fixable)".to_string()),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}
