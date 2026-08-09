mod common;

use herb_highlighter::diff_computer::compute_diff_hunks;
use herb_highlighter::diff_renderer::{DiffLayout, DiffRenderOptions, SingleLineStyle};
use herb_highlighter::document::Document;
use herb_highlighter::document_builder::DiffDocumentOptions;
use herb_highlighter::highlighter::Highlighter;
use herb_highlighter::html_sink::{render_document_html, HTMLSinkOptions, MarkerMode};

use common::with_color;

const PATH: &str = "app/views/users/show.html.erb";

const DIFF_BEFORE: &str = "<div>\n  <p>one</p>\n  <p>two</p>\n  <span>tail</span>\n</div>";
const DIFF_AFTER: &str = "<div>\n  <p>one</p>\n  <p>tres</p>\n  <span>tail</span>\n</div>";

const TWO_HUNK_BEFORE: &str = "<ul>\n  <li>a</li>\n  <li>b</li>\n  <li>c</li>\n  <li>d</li>\n  <li>e</li>\n  <li>f</li>\n  <li>g</li>\n</ul>";
const TWO_HUNK_AFTER: &str = "<ul>\n  <li>A</li>\n  <li>b</li>\n  <li>c</li>\n  <li>d</li>\n  <li>e</li>\n  <li>f</li>\n  <li>G</li>\n</ul>";

fn highlighter() -> Highlighter {
  Highlighter::new("onedark").expect("the theme resolves")
}

fn to_json(document: &Document) -> String {
  serde_json::to_string_pretty(document).expect("the document serializes")
}

fn sink_options(diff_layout: DiffLayout) -> HTMLSinkOptions {
  HTMLSinkOptions {
    theme_label: "onedark".to_string(),
    show_line_numbers: true,
    markers: MarkerMode::Spans,
    diff_layout,
  }
}

#[test]
fn builds_a_diff_document() {
  with_color();

  let document = highlighter().build_diff_document(PATH, DIFF_BEFORE, DIFF_AFTER, &DiffDocumentOptions::default());

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_a_diff_document_from_hunks() {
  with_color();

  let hunks = compute_diff_hunks(DIFF_BEFORE, DIFF_AFTER, 2);
  let document = highlighter().build_diff_document_from_hunks(PATH, &hunks, &DiffDocumentOptions::default());

  insta::assert_snapshot!(to_json(&document));
}

#[test]
fn builds_an_empty_document_for_identical_content() {
  with_color();

  let document = highlighter().build_diff_document(PATH, DIFF_BEFORE, DIFF_BEFORE, &DiffDocumentOptions::default());

  assert!(document.nodes.is_empty());
}

#[test]
fn renders_a_unified_diff() {
  with_color();

  let document = highlighter().build_diff_document(
    PATH,
    TWO_HUNK_BEFORE,
    TWO_HUNK_AFTER,
    &DiffDocumentOptions {
      context_lines: 1,
      highlight_inline_changes: true,
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(DiffLayout::Unified)));
}

#[test]
fn renders_a_split_diff_with_columns() {
  with_color();

  let document = highlighter().build_diff_document(
    PATH,
    TWO_HUNK_BEFORE,
    TWO_HUNK_AFTER,
    &DiffDocumentOptions {
      context_lines: 1,
      highlight_inline_changes: true,
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(DiffLayout::Split)));
}

#[test]
fn renders_inline_change_marks() {
  with_color();

  let document = highlighter().build_diff_document(PATH, DIFF_BEFORE, DIFF_AFTER, &DiffDocumentOptions::default());

  insta::assert_snapshot!(render_document_html(&document, &sink_options(DiffLayout::Unified)));
}

#[test]
fn ansi_diff_is_byte_identical_through_the_document_path() {
  with_color();

  let highlighter = highlighter();

  insta::assert_snapshot!(highlighter.highlight_diff(PATH, DIFF_BEFORE, DIFF_AFTER, &DiffRenderOptions::default()));

  insta::assert_snapshot!(highlighter.highlight_diff(
    PATH,
    DIFF_BEFORE,
    DIFF_AFTER,
    &DiffRenderOptions {
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  ));
}
