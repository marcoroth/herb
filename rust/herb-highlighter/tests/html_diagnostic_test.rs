use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::document_builder::{CardOptions, DocumentBuilder};
use herb_highlighter::highlighter::{HighlightOptions, Highlighter};
use herb_highlighter::html_sink::{render_document_html, wrap_document_html, HTMLSinkOptions, MarkerMode};
use herb_highlighter::stylesheet::generate_stylesheet;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

const PATH: &str = "app/views/users/show.html.erb";
const CONTENT: &str = "<div>\n  <%= user.name %>\n  <p>hello</p>\n  <span>world</span>\n</div>";
const OVERLAP_CONTENT: &str = "<div id=\"x\">text</div>";

fn multi_line_diagnostic() -> Diagnostic {
  Diagnostic::new("unclosed `<%=` tag", SerializedLocation::from(2, 2, 3, 6), DiagnosticSeverity::Error).with_code("parser-error")
}

fn warning_diagnostic() -> Diagnostic {
  Diagnostic::new("avoid inline spans", SerializedLocation::from(4, 2, 4, 8), DiagnosticSeverity::Warning)
}

fn overlap_error_diagnostic() -> Diagnostic {
  Diagnostic::new("first", SerializedLocation::from(1, 5, 1, 12), DiagnosticSeverity::Error)
}

fn overlap_warning_diagnostic() -> Diagnostic {
  Diagnostic::new("second", SerializedLocation::from(1, 8, 1, 16), DiagnosticSeverity::Warning)
}

fn unsafe_diagnostic() -> Diagnostic {
  Diagnostic::new("bad <img> in `attr`", SerializedLocation::from(2, 2, 2, 6), DiagnosticSeverity::Error).with_code("unsafe-rule")
}

fn highlighter() -> Highlighter {
  Highlighter::new("onedark").expect("the theme resolves")
}

fn sink_options(markers: MarkerMode) -> HTMLSinkOptions {
  HTMLSinkOptions {
    theme_label: "onedark".to_string(),
    show_line_numbers: true,
    markers,
  }
}

#[test]
fn renders_an_inline_diagnostics_document_with_span_markers() {
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::Spans)));
}

#[test]
fn renders_an_inline_diagnostics_document_with_highlight_api_markers() {
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::HighlightApi)));
}

#[test]
fn renders_a_card_document() {
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

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::Spans)));
}

#[test]
fn renders_a_split_document_with_progress_rules() {
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

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::Spans)));
}

#[test]
fn escapes_markup_in_messages_and_rejects_unsafe_urls() {
  let diagnostics = [unsafe_diagnostic()];
  let code_url_builder = |_code: &str| "javascript:alert(1)".to_string();

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      code_url_builder: Some(&code_url_builder),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::Spans)));
}

#[test]
fn overlapping_markers_use_the_highest_severity() {
  let diagnostics = [overlap_error_diagnostic(), overlap_warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    OVERLAP_CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(render_document_html(&document, &sink_options(MarkerMode::Spans)));
}

#[test]
fn wraps_a_document_with_chrome_and_hydration() {
  let diagnostics = [multi_line_diagnostic(), warning_diagnostic()];

  let document = highlighter().build_document(
    PATH,
    CONTENT,
    &HighlightOptions {
      diagnostics: &diagnostics,
      ..Default::default()
    },
  );

  let fragment = render_document_html(&document, &sink_options(MarkerMode::HighlightApi));
  let stylesheet = generate_stylesheet(get_theme(Theme::OneDark), "onedark", None);

  insta::assert_snapshot!(wrap_document_html(&fragment, &stylesheet, true));
}
