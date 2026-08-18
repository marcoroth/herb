mod common;

use std::fs;

use herb_highlighter::ansi::strip_ansi;
use herb_highlighter::highlighter::{highlight_content, highlight_file, HighlightOptions, Highlighter};

use common::{no_color, with_color};

fn highlighter(theme: &str) -> Highlighter {
  Highlighter::new(theme).expect("the theme resolves")
}

fn plain() -> HighlightOptions<'static> {
  HighlightOptions {
    show_line_numbers: false,
    ..Default::default()
  }
}

#[test]
fn highlights_basic_html_tags() {
  with_color();

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", "<h1>Hello</h1>", &plain()));
}

#[test]
fn highlights_erb_blocks_with_ruby_syntax() {
  with_color();

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", "<% if true %>", &plain()));
}

#[test]
fn highlights_complex_erb_with_if_elsif_else_end() {
  with_color();

  let input = "<% if condition %>\n    <div>One</div>\n<% elsif other %>\n    <div>Two</div>\n<% else %>\n    <div>Three</div>\n<% end %>";

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", input, &plain()));
}

#[test]
fn highlights_html_attributes() {
  with_color();

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", "<div class=\"example\" id=\"test\">", &plain()));
}

#[test]
fn handles_erb_output_tags() {
  with_color();

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", "<%= user.name %>", &plain()));
}

#[test]
fn does_not_add_colors_when_color_is_off() {
  no_color();

  let input = "<% if true %>";
  let result = highlighter("onedark").highlight("test.erb", input, &plain());

  assert_eq!(result, input);

  insta::assert_snapshot!(result);
}

#[test]
fn handles_mixed_html_and_erb_content() {
  with_color();

  insta::assert_snapshot!(highlighter("onedark").highlight("test.erb", "<h1 id=\"<%= dom_id(article) %>\">Title</h1>", &plain()));
}

#[test]
fn handles_all_ruby_keywords_correctly() {
  with_color();

  let keywords = [
    "if", "unless", "else", "elsif", "end", "def", "class", "module", "return", "yield", "break", "next", "case", "when", "then", "while", "until", "for",
    "in", "do", "begin", "rescue", "ensure", "retry", "raise", "super", "self", "nil", "true", "false", "and", "or", "not",
  ];

  let highlighter = highlighter("onedark");

  let highlighted: Vec<String> = keywords
    .iter()
    .map(|keyword| highlighter.highlight("test.erb", &format!("<% {keyword} %>"), &plain()))
    .collect();

  insta::assert_snapshot!(highlighted.join("\n"));
}

#[test]
fn highlights_a_file() {
  with_color();

  let directory = tempfile::tempdir().expect("a temporary directory");
  let file = directory.path().join("test-highlighter-file.html.erb");

  fs::write(
    &file,
    "<div class=\"container\">\n  <% if user %>\n    <span>Hello <%= user.name %>!</span>\n  <% end %>\n</div>",
  )
  .expect("the file is written");

  let result = highlighter("onedark")
    .highlight_file_from_path(&file.to_string_lossy(), &HighlightOptions::default())
    .expect("the file is highlighted");

  insta::assert_snapshot!(result.replace(&*directory.path().to_string_lossy(), "<test-dir>"));
}

#[test]
fn returns_an_error_for_a_non_existent_file() {
  with_color();

  let error = highlighter("onedark")
    .highlight_file_from_path("non-existent-file.erb", &HighlightOptions::default())
    .expect_err("the file does not exist");

  assert!(error.message.contains("Failed to read file"));
}

#[test]
fn highlight_content_works_with_default_theme() {
  with_color();

  let result = highlight_content("<% def hello %><span>Hi</span><% end %>", "onedark", &HighlightOptions::default()).expect("the content is highlighted");

  insta::assert_snapshot!(result);
}

#[test]
fn highlight_content_works_with_github_light_theme() {
  with_color();

  insta::assert_snapshot!(highlight_content("<% true %>", "github-light", &HighlightOptions::default()).expect("the content is highlighted"));
}

#[test]
fn highlight_file_works_with_default_theme() {
  with_color();

  let directory = tempfile::tempdir().expect("a temporary directory");
  let file = directory.path().join("test-utility-file.html.erb");

  fs::write(&file, "<h1>\n  <% unless condition %>\n    <p>Default content</p>\n  <% end %>\n</h1>").expect("the file is written");

  let result = highlight_file(&file.to_string_lossy(), "onedark", &HighlightOptions::default()).expect("the file is highlighted");

  insta::assert_snapshot!(result.replace(&*file.to_string_lossy(), "<test-file>"));
}

#[test]
fn highlight_file_works_with_simple_theme() {
  with_color();

  let directory = tempfile::tempdir().expect("a temporary directory");
  let file = directory.path().join("test-utility-file.html.erb");

  fs::write(&file, "<h1>\n  <% unless condition %>\n    <p>Default content</p>\n  <% end %>\n</h1>").expect("the file is written");

  let result = highlight_file(&file.to_string_lossy(), "simple", &HighlightOptions::default()).expect("the file is highlighted");

  insta::assert_snapshot!(result.replace(&*file.to_string_lossy(), "<test-file>"));
}

#[test]
fn highlight_file_returns_an_error_for_a_non_existent_file() {
  with_color();

  let error = highlight_file("non-existent-file.erb", "onedark", &HighlightOptions::default()).expect_err("the file does not exist");

  assert!(error.message.contains("Failed to read file"));
}

#[test]
fn supports_focus_line_with_context_lines() {
  with_color();

  let content = "<h1>Title</h1>\n<div class=\"container\">\n  <% if user %>\n    <span>Welcome</span>\n  <% end %>\n</div>";

  let result = highlighter("onedark").highlight(
    "test.erb",
    content,
    &HighlightOptions {
      focus_line: Some(3),
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}

#[test]
fn supports_the_truncate_lines_option() {
  with_color();

  let content =
    "<div class=\"this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-exceeds-maximum-width\">Content</div>\n<span>Short line</span>";

  let result = highlighter("onedark").highlight(
    "test.erb",
    content,
    &HighlightOptions {
      wrap_lines: false,
      truncate_lines: true,
      max_width: Some(60),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi(&result));
}
