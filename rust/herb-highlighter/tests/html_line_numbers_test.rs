use std::fs;
use std::path::Path;

use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::diff_renderer::DiffLayout;
use herb_highlighter::document_builder::DiffDocumentOptions;
use herb_highlighter::highlighter::{HighlightOptions, Highlighter};
use herb_highlighter::html_sink::{render_document_html, HTMLSinkOptions, LineNumberStyle, MarkerMode};

const PATH: &str = "app/views/users/show.html.erb";
const CONTENT: &str = "<div>\n  <%= user.name %>\n  <p>hello</p>\n  <span>world</span>\n</div>";

const DIFF_BEFORE: &str = "<div>\n  <p>one</p>\n  <p>two</p>\n  <span>tail</span>\n</div>";
const DIFF_AFTER: &str = "<div>\n  <p>one</p>\n  <p>tres</p>\n  <span>tail</span>\n</div>";

fn multi_line_diagnostic() -> Diagnostic {
  Diagnostic::new("unclosed `<%=` tag", SerializedLocation::from(2, 2, 3, 6), DiagnosticSeverity::Error).with_code("parser-error")
}

fn warning_diagnostic() -> Diagnostic {
  Diagnostic::new("avoid inline spans", SerializedLocation::from(4, 2, 4, 8), DiagnosticSeverity::Warning)
}

fn highlighter() -> Highlighter {
  Highlighter::new("onedark").expect("the theme resolves")
}

fn sink_options(line_number_style: LineNumberStyle, diff_layout: DiffLayout) -> HTMLSinkOptions {
  HTMLSinkOptions {
    theme_label: "onedark".to_string(),
    show_line_numbers: true,
    line_number_style,
    markers: MarkerMode::Spans,
    diff_layout,
    ..Default::default()
  }
}

fn snapshot_body(name: &str) -> String {
  let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("snapshots").join(name);
  let contents = fs::read_to_string(path).expect("the snapshot exists");
  let (_, body) = contents.split_once("\n---\n").expect("the snapshot has a header");

  body.trim_end_matches('\n').to_string()
}

#[test]
fn renders_line_number_elements_in_a_file_listing() {
  let document = highlighter().build_document(PATH, CONTENT, &HighlightOptions::default());

  insta::assert_snapshot!(render_document_html(&document, &sink_options(LineNumberStyle::Element, DiffLayout::Unified)));
}

#[test]
fn renders_line_number_elements_with_diagnostics() {
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(LineNumberStyle::Element, DiffLayout::Unified)));
}

#[test]
fn renders_line_number_elements_in_a_diff() {
  let document = highlighter().build_diff_document(PATH, DIFF_BEFORE, DIFF_AFTER, &DiffDocumentOptions::default());

  insta::assert_snapshot!(render_document_html(&document, &sink_options(LineNumberStyle::Element, DiffLayout::Unified)));
}

#[test]
fn css_line_numbers_stay_byte_identical() {
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let annotated = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  assert_eq!(
    render_document_html(&annotated, &sink_options(LineNumberStyle::Css, DiffLayout::Unified)),
    snapshot_body("html_diagnostic_test__renders_an_inline_diagnostics_document_with_span_markers.snap")
  );

  let diff = highlighter().build_diff_document(PATH, DIFF_BEFORE, DIFF_AFTER, &DiffDocumentOptions::default());

  assert_eq!(
    render_document_html(&diff, &sink_options(LineNumberStyle::Css, DiffLayout::Unified)),
    snapshot_body("diff_document_test__renders_inline_change_marks.snap")
  );
}
