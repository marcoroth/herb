mod common;

use herb_highlighter::diagnostic::{Diagnostic, DiagnosticSeverity, SerializedLocation};
use herb_highlighter::file_renderer::RenderOptions;
use herb_highlighter::inline_diagnostic_renderer::InlineDiagnosticRenderer;
use herb_highlighter::line_wrapper::LineWrapper;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{strip_ansi_colors, with_color};

fn syntax_renderer() -> SyntaxRenderer {
  SyntaxRenderer::new(get_theme(Theme::OneDark).clone())
}

fn diagnostic() -> Diagnostic {
  Diagnostic::new("Test error message", SerializedLocation::from(2, 5, 2, 10), DiagnosticSeverity::Error).with_code("test-rule")
}

fn render(content: &str, diagnostics: &[Diagnostic], show_line_numbers: bool) -> String {
  let syntax_renderer = syntax_renderer();
  let renderer = InlineDiagnosticRenderer::new(&syntax_renderer);

  let options = RenderOptions {
    show_line_numbers,
    wrap_lines: false,
    max_width: LineWrapper::get_terminal_width(),
    truncate_lines: false,
  };

  strip_ansi_colors(&renderer.render("/test/file.erb", content, diagnostics, &options, None))
}

#[test]
fn renders_a_single_line_diagnostic_with_its_message_under_the_marker() {
  with_color();

  let content = "line 1\nline <error> content\nline 3";

  insta::assert_snapshot!(render(content, &[diagnostic()], true));
}

#[test]
fn marks_every_line_a_multi_line_diagnostic_spans() {
  with_color();

  let content = "<div id=\"gems\">\n  <% @gems.each do |topic_gem| %>\n    <%= render partial: \"gem_card\" %>\n  <% end %>\n</div>";

  let diagnostic = Diagnostic::new("Multi-line offense", SerializedLocation::from(2, 2, 4, 11), DiagnosticSeverity::Warning).with_code("multi-line-rule");

  insta::assert_snapshot!(render(content, &[diagnostic], true));
}

#[test]
fn renders_the_message_once_under_the_last_line_of_a_multi_line_diagnostic() {
  with_color();

  let content = "<% if true %>\n  <span>content</span>\n<% end %>";

  let mut diagnostic = diagnostic();
  diagnostic.message = "Multi-line offense".to_string();
  diagnostic.location = SerializedLocation::from(1, 0, 3, 9);

  let result = render(content, &[diagnostic], true);

  assert_eq!(result.matches("Multi-line offense").count(), 1);

  insta::assert_snapshot!(result);
}

#[test]
fn renders_markers_without_line_numbers() {
  with_color();

  let content = "line 1\nline <error> content\nline 3";

  insta::assert_snapshot!(render(content, &[diagnostic()], false));
}
