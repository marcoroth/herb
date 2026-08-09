mod common;

use herb_highlighter::file_renderer::{FileRenderer, RenderOptions};
use herb_highlighter::line_wrapper::LineWrapper;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, strip_ansi_colors, with_color};

fn syntax_renderer(theme: Theme) -> SyntaxRenderer {
  SyntaxRenderer::new(get_theme(theme).clone())
}

fn width() -> usize {
  LineWrapper::get_terminal_width()
}

fn options(wrap_lines: bool, max_width: usize, truncate_lines: bool) -> RenderOptions {
  RenderOptions {
    show_line_numbers: true,
    wrap_lines,
    max_width,
    truncate_lines,
  }
}

#[test]
fn renders_content_with_line_numbers() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "line 1\nline 2\nline 3", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_single_line_content() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "single line", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_empty_content() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_content_with_empty_lines() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "line 1\n\nline 3", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn applies_syntax_highlighting_with_line_numbers() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  insta::assert_snapshot!(renderer.render_with_line_numbers("/test/file.erb", "<div>Hello</div>", &options(false, width(), false)));
}

#[test]
fn highlights_focus_line_and_dims_others() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_focus_line(
    "/test/file.erb",
    "line 1\nline 2\nline 3\nline 4\nline 5",
    3,
    1,
    &RenderOptions {
      show_line_numbers: true,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false,
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_focus_line_at_beginning_of_file() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_focus_line(
    "/test/file.erb",
    "line 1\nline 2\nline 3",
    1,
    1,
    &RenderOptions {
      show_line_numbers: true,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false,
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_focus_line_at_end_of_file() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_focus_line(
    "/test/file.erb",
    "line 1\nline 2\nline 3",
    3,
    1,
    &RenderOptions {
      show_line_numbers: true,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false,
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_large_context_that_exceeds_file_bounds() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_focus_line(
    "/test/file.erb",
    "line 1\nline 2",
    1,
    10,
    &RenderOptions {
      show_line_numbers: true,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false,
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn works_without_line_numbers() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_focus_line(
    "/test/file.erb",
    "line 1\nline 2\nline 3",
    2,
    1,
    &RenderOptions {
      show_line_numbers: false,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false,
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn applies_syntax_highlighting_with_focus_line() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let content = "<div>line 1</div>\n<span>line 2</span>\n<p>line 3</p>";

  insta::assert_snapshot!(renderer.render_with_focus_line(
    "/test/file.erb",
    content,
    2,
    1,
    &RenderOptions {
      show_line_numbers: true,
      wrap_lines: false,
      max_width: width(),
      truncate_lines: false
    }
  ));
}

#[test]
fn renders_content_without_line_numbers_or_file_headers() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_plain("line 1\nline 2\nline 3", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn applies_syntax_highlighting_in_plain_rendering() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  insta::assert_snapshot!(renderer.render_plain("<div>Hello World</div>", &options(false, width(), false)));
}

#[test]
fn handles_empty_content_in_plain_rendering() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  assert_eq!(renderer.render_plain("", &options(false, width(), false)), "");
}

#[test]
fn preserves_exact_content_structure() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let content = "line 1\n\nline 3\n    indented line";
  let result = renderer.render_plain(content, &options(false, width(), false));

  assert!(strip_ansi_colors(&result).contains(content));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn works_with_different_themes() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::GithubLight);
  let renderer = FileRenderer::new(&syntax_renderer);

  insta::assert_snapshot!(renderer.render_with_line_numbers("/test/file.erb", "<div>test</div>", &options(false, width(), false)));
}

#[test]
fn works_with_simple_theme() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::Simple);
  let renderer = FileRenderer::new(&syntax_renderer);

  insta::assert_snapshot!(renderer.render_plain("<span>test</span>", &options(false, width(), false)));
}

#[test]
fn truncates_long_lines_with_ellipsis() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let long_content = "This is a very long line that should be truncated when it exceeds the maximum width limit";
  let result = renderer.render_with_line_numbers("/test/file.erb", long_content, &options(false, 50, true));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn truncates_lines_in_plain_rendering() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let long_content = "This is another very long line that should be truncated when using renderPlain method";
  let result = renderer.render_plain(long_content, &options(false, 50, true));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn does_not_truncate_lines_shorter_than_max_width() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "Short line", &options(false, 50, true));
  let stripped = strip_ansi_colors(&result);

  assert!(!stripped.contains('…'));

  insta::assert_snapshot!(stripped);
}

#[test]
fn respects_the_no_color_setting() {
  no_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  insta::assert_snapshot!(renderer.render_with_line_numbers("/test/file.erb", "<div>test</div>", &options(false, width(), false)));
}

#[test]
fn handles_very_long_lines() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let long_line = "a".repeat(1000);
  let content = format!("short line\n{long_line}\nshort line");
  let result = renderer.render_with_line_numbers("/test/file.erb", &content, &options(false, width(), false));

  assert!(strip_ansi_colors(&result).contains(&long_line));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_special_characters() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let content = "line with\ttabs\nline with \"quotes\"\nline with \"single quotes\"";
  let result = renderer.render_with_line_numbers("/test/file.erb", content, &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn handles_unicode_characters() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let result = renderer.render_with_line_numbers("/test/file.erb", "Unicode: 🎉 émojis and àccénts", &options(false, width(), false));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn renders_a_multi_line_comment_with_line_numbers() {
  with_color();

  let syntax_renderer = syntax_renderer(Theme::OneDark);
  let renderer = FileRenderer::new(&syntax_renderer);

  let content = "<div>\n  <!-- first comment line\n  second comment line -->\n  <span>ok</span>\n</div>";

  insta::assert_snapshot!(renderer.render_with_line_numbers("/test/file.erb", content, &options(false, width(), false)));
}
