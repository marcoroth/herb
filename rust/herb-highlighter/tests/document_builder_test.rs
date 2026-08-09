mod common;

use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::document::Document;
use herb_highlighter::document_builder::{CardOptions, DocumentBuilder};
use herb_highlighter::highlighter::{HighlightOptions, Highlighter};
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, with_color};

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

fn to_json(document: &Document) -> String {
  serde_json::to_string_pretty(document).expect("the document serializes")
}

#[test]
fn builds_a_file_document() {
  with_color();

  let document = highlighter().build_document(PATH, CONTENT, &HighlightOptions::default());

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_a_plain_document() {
  with_color();

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      show_line_numbers: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_a_focus_document() {
  with_color();

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      focus_line: Some(3),
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_an_inline_diagnostics_document() {
  with_color();

  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_a_card_document() {
  with_color();

  let syntax_renderer = SyntaxRenderer::new(get_theme(Theme::OneDark).clone());
  let builder = DocumentBuilder::new(&syntax_renderer);

  let document = builder.build_card(
    PATH,
    &multi_line_diagnostic(),
    CONTENT,
    &CardOptions {
      context_lines: 1,
      optimize_highlighting: true,
      code_url: Some("https://herb.tools/rules/parser-error".to_string()),
      file_url: Some("file:///app/views/show.html.erb".to_string()),
      suffix: Some("(fixable)".to_string()),
    },
  );

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_a_split_document() {
  with_color();

  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      split_diagnostics: true,
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_an_empty_content_document() {
  with_color();

  let document = highlighter().build_document(PATH, "", &HighlightOptions::default());

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn json_is_independent_of_color_state() {
  let highlighter = highlighter();
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let options = HighlightOptions {
    diagnostics: &diagnostics,
    ..Default::default()
  };

  with_color();
  let colored = to_json(&highlighter.build_document(PATH, CONTENT, &options));

  no_color();
  let uncolored = to_json(&highlighter.build_document(PATH, CONTENT, &options));

  assert_eq!(colored, uncolored);
}
