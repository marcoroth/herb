mod common;

use herb_highlighter::ansi::find_ansi_sequences;
use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::diagnostic_renderer::{DiagnosticRenderOptions, DiagnosticRenderer};
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, strip_ansi_colors, with_color};

fn syntax_renderer() -> SyntaxRenderer {
  SyntaxRenderer::new(get_theme(Theme::OneDark).clone())
}

fn diagnostic() -> Diagnostic {
  Diagnostic::new("Test error message", SerializedLocation::from(2, 5, 2, 10), DiagnosticSeverity::Error).with_code("test-rule")
}

#[test]
fn renders_a_single_error_diagnostic() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "line 1\nline <error> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic(), content, &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn renders_a_single_warning_diagnostic() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.severity = DiagnosticSeverity::Warning;

  let content = "line 1\nline <warn> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic, content, &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_custom_context_lines() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(5, 1, 5, 5);

  let content = "line 1\nline 2\nline 3\nline 4\nline 5 error\nline 6\nline 7";

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn hides_line_numbers_when_requested() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "line 1\nline <error> content\nline 3";

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic(),
    content,
    &DiagnosticRenderOptions {
      show_line_numbers: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_edge_cases_for_line_boundaries() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(1, 1, 1, 5);

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    "single line",
    &DiagnosticRenderOptions {
      context_lines: 5,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn highlights_backticks_in_messages() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.message = "Error with `code` in message".to_string();

  let content = "line 1\nline <error> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic, content, &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_multi_character_error_ranges() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(2, 5, 2, 15);

  let content = "line 1\nline <long error> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic, content, &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_invalid_line_numbers_gracefully() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(999, 1, 999, 5);

  let result = renderer.render_single("/test/file.erb", &diagnostic, "line 1\nline 2", &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_invalid_column_numbers_gracefully() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(2, 999, 2, 1000);

  let result = renderer.render_single("/test/file.erb", &diagnostic, "line 1\nshort\nline 3", &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

const MULTI_LINE_CONTENT: &str =
  "<div>\n\n  <div id=\"gems\">\n    <% @gems.each do |topic_gem| %>\n      <%= render partial: \"gem_card\" %>\n    <% end %>\n  </div>\n\n</div>";

fn multi_line_diagnostic() -> Diagnostic {
  Diagnostic::new("Multi-line offense", SerializedLocation::from(4, 4, 6, 13), DiagnosticSeverity::Warning).with_code("multi-line-rule")
}

#[test]
fn marks_every_line_the_diagnostic_spans_and_expands_the_trailing_context() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let result = renderer.render_single(
    "/test/file.erb",
    &multi_line_diagnostic(),
    MULTI_LINE_CONTENT,
    &DiagnosticRenderOptions {
      wrap_lines: false,
      context_lines: 2,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn does_not_mark_blank_lines_inside_the_span() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let mut diagnostic = diagnostic();
  diagnostic.location = SerializedLocation::from(1, 0, 3, 9);

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    "<% if true %>\n\n<% end %>",
    &DiagnosticRenderOptions {
      wrap_lines: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn aligns_markers_to_the_content_when_line_numbers_are_hidden() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let result = renderer.render_single(
    "/test/file.erb",
    &multi_line_diagnostic(),
    MULTI_LINE_CONTENT,
    &DiagnosticRenderOptions {
      wrap_lines: false,
      context_lines: 2,
      show_line_numbers: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn keeps_a_single_marker_for_single_line_diagnostics() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic(),
    "line 1\nline <error> content\nline 3",
    &DiagnosticRenderOptions {
      wrap_lines: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn shows_ellipsis_at_end_when_diagnostic_is_at_start_of_long_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long\">Content</div>";

  let diagnostic = Diagnostic::new(
    "Class name should be shorter",
    SerializedLocation::from(1, 13, 1, 33),
    DiagnosticSeverity::Error,
  )
  .with_code("class-name-length");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(60),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn shows_ellipsis_at_beginning_when_diagnostic_is_at_end_of_long_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long\">Content</div>";

  let diagnostic = Diagnostic::new(
    "Content should be more descriptive",
    SerializedLocation::from(1, 95, 1, 102),
    DiagnosticSeverity::Warning,
  )
  .with_code("content-description");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(60),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn shows_ellipsis_on_both_sides_when_diagnostic_is_in_middle_of_long_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long-with-more-content\">Content</div>";

  let diagnostic = Diagnostic::new(
    "Avoid 'should-be' in class names",
    SerializedLocation::from(1, 45, 1, 54),
    DiagnosticSeverity::Error,
  )
  .with_code("class-naming-convention");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(60),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn adjusts_pointer_position_correctly_for_truncated_diagnostics() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated\">Content</div>";

  let diagnostic =
    Diagnostic::new("Test diagnostic positioning", SerializedLocation::from(1, 50, 1, 55), DiagnosticSeverity::Error).with_code("test-positioning");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(40),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_truncation_with_context_lines() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"short-line\">Short</div>\n<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long\">Content</div>\n<div class=\"another-short-line\">Short</div>";

  let diagnostic =
    Diagnostic::new("Long class name detected", SerializedLocation::from(2, 13, 2, 30), DiagnosticSeverity::Error).with_code("class-name-length");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(60),
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn does_not_truncate_when_max_width_is_sufficient() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let diagnostic = Diagnostic::new("Test short line", SerializedLocation::from(1, 13, 1, 18), DiagnosticSeverity::Error).with_code("test-short");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    "<div class=\"short\">Content</div>",
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(100),
      ..Default::default()
    },
  );

  let stripped = strip_ansi_colors(&result);

  assert!(!stripped.contains('…'));

  insta::assert_snapshot!(stripped);
}

#[test]
fn preserves_syntax_highlighting_colors_in_truncated_output() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long\">Content</div>";

  let diagnostic = Diagnostic::new("Line too long", SerializedLocation::from(1, 1, 1, 5), DiagnosticSeverity::Error).with_code("line-length");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(50),
      ..Default::default()
    },
  );

  assert!(!find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

#[test]
fn preserves_colors_when_extracting_from_end_of_styled_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long\">ShortEnd</div>";

  let diagnostic = Diagnostic::new("End content issue", SerializedLocation::from(1, 95, 1, 103), DiagnosticSeverity::Error).with_code("end-content");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(50),
      ..Default::default()
    },
  );

  assert!(!find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

#[test]
fn preserves_colors_when_extracting_from_middle_of_styled_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div class=\"aaaaaaaaaaaaaaaa-MIDDLE_TARGET-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\">end</div>";

  let diagnostic = Diagnostic::new("Middle issue", SerializedLocation::from(1, 30, 1, 44), DiagnosticSeverity::Error).with_code("middle-content");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      truncate_lines: true,
      max_width: Some(50),
      ..Default::default()
    },
  );

  assert!(!find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

#[test]
fn renders_a_card_with_the_simple_theme() {
  with_color();

  let syntax_renderer = SyntaxRenderer::new(get_theme(Theme::Simple).clone());
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "line 1\nline <error> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic(), content, &DiagnosticRenderOptions::default());

  insta::assert_snapshot!(result);
}

#[test]
fn dims_context_lines_over_rgb_colors() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "<div>\n  <span>bad</span>\n  <p>ok</p>\n</div>";
  let diagnostic = Diagnostic::new("Bad span", SerializedLocation::from(2, 2, 2, 8), DiagnosticSeverity::Error).with_code("dim-rule");

  let result = renderer.render_single(
    "/test/file.erb",
    &diagnostic,
    content,
    &DiagnosticRenderOptions {
      wrap_lines: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}

#[test]
fn respects_the_no_color_setting() {
  no_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiagnosticRenderer::new(&syntax_renderer);

  let content = "line 1\nline <error> content\nline 3";
  let result = renderer.render_single("/test/file.erb", &diagnostic(), content, &DiagnosticRenderOptions::default());

  assert!(find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}
