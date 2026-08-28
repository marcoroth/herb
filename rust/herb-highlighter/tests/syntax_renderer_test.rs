mod common;

use std::sync::Arc;

use herb_highlighter::ansi::find_ansi_sequences;
use herb_highlighter::color::colorize;
use herb_highlighter::herb_backend::Herb;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, strip_ansi_colors, token, with_color, StubBackend};

fn renderer(theme: Theme) -> SyntaxRenderer {
  SyntaxRenderer::with_backend(get_theme(theme).clone(), Arc::new(Herb))
}

#[test]
fn returns_original_content_for_lex_errors() {
  with_color();

  let error_renderer = SyntaxRenderer::with_backend(get_theme(Theme::OneDark).clone(), StubBackend::failing());

  let content = "<invalid>";

  assert_eq!(error_renderer.highlight(content), content);
}

#[test]
fn highlights_simple_html() {
  with_color();

  insta::assert_snapshot!(renderer(Theme::OneDark).highlight("<div>hello</div>"));
}

#[test]
fn handles_empty_content() {
  with_color();

  assert_eq!(renderer(Theme::OneDark).highlight(""), "");
}

#[test]
fn handles_content_with_no_tokens() {
  with_color();

  let no_token_renderer = SyntaxRenderer::with_backend(get_theme(Theme::OneDark).clone(), StubBackend::with_tokens(Vec::new()));

  let content = "plain text";

  assert_eq!(no_token_renderer.highlight(content), content);
}

#[test]
fn works_with_different_themes() {
  with_color();

  insta::assert_snapshot!(renderer(Theme::GithubLight).highlight("<div>test</div>"));
}

#[test]
fn works_with_simple_theme() {
  with_color();

  insta::assert_snapshot!(renderer(Theme::Simple).highlight("<div>test</div>"));
}

#[test]
fn returns_plain_text_when_color_is_off() {
  no_color();

  let result = renderer(Theme::OneDark).highlight("<div>test</div>");

  assert!(find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

#[test]
fn highlights_ruby_keywords_in_erb_blocks() {
  with_color();

  let erb_renderer = SyntaxRenderer::with_backend(
    get_theme(Theme::OneDark).clone(),
    StubBackend::with_tokens(vec![
      token("TOKEN_ERB_START", 0, 2),
      token("TOKEN_ERB_CONTENT", 2, 12),
      token("TOKEN_ERB_END", 12, 14),
    ]),
  );

  insta::assert_snapshot!(erb_renderer.highlight("<% if true %>"));
}

#[test]
fn tracks_html_comment_state() {
  with_color();

  let comment_renderer = SyntaxRenderer::with_backend(
    get_theme(Theme::OneDark).clone(),
    StubBackend::with_tokens(vec![
      token("TOKEN_HTML_COMMENT_START", 0, 4),
      token("TOKEN_IDENTIFIER", 4, 11),
      token("TOKEN_HTML_COMMENT_END", 11, 14),
    ]),
  );

  insta::assert_snapshot!(comment_renderer.highlight("<!-- comment -->"));
}

#[test]
fn preserves_erb_highlighting_in_comments() {
  with_color();

  let erb_comment_renderer = SyntaxRenderer::with_backend(
    get_theme(Theme::OneDark).clone(),
    StubBackend::with_tokens(vec![
      token("TOKEN_HTML_COMMENT_START", 0, 4),
      token("TOKEN_ERB_START", 5, 7),
      token("TOKEN_ERB_CONTENT", 7, 12),
      token("TOKEN_ERB_END", 12, 14),
      token("TOKEN_HTML_COMMENT_END", 15, 18),
    ]),
  );

  insta::assert_snapshot!(erb_comment_renderer.highlight("<!-- <% code %> -->"));
}

#[test]
fn highlights_an_erb_comment_tag_and_its_content_as_a_comment() {
  with_color();

  let theme = get_theme(Theme::OneDark).clone();
  let comment = theme.token_html_comment_start;
  let erb_start = theme.token_erb_start;

  let renderer = SyntaxRenderer::with_backend(
    theme,
    StubBackend::with_tokens(vec![
      token("TOKEN_ERB_START", 0, 3),
      token("TOKEN_ERB_CONTENT", 3, 9),
      token("TOKEN_ERB_END", 9, 11),
    ]),
  );

  let content = "<%# note %>";
  let result = renderer.highlight(content);

  assert!(result.contains(&colorize("<%#", comment)));
  assert!(result.contains(&colorize(" note ", comment)));
  assert!(result.contains(&colorize("%>", comment)));
  assert!(!result.contains(&colorize("<%#", erb_start)));
  assert_eq!(strip_ansi_colors(&result), content);
}

#[test]
fn does_not_highlight_ruby_keywords_inside_an_erb_comment() {
  with_color();

  let theme = get_theme(Theme::OneDark).clone();
  let comment = theme.token_html_comment_start;
  let keyword = theme.ruby_keyword;

  let renderer = SyntaxRenderer::with_backend(
    theme,
    StubBackend::with_tokens(vec![
      token("TOKEN_ERB_START", 0, 3),
      token("TOKEN_ERB_CONTENT", 3, 11),
      token("TOKEN_ERB_END", 11, 13),
    ]),
  );

  let content = "<%# if end %>";
  let result = renderer.highlight(content);

  assert!(!result.contains(&colorize("if", keyword)));
  assert!(!result.contains(&colorize("end", keyword)));
  assert!(result.contains(&colorize(" if end ", comment)));
  assert_eq!(strip_ansi_colors(&result), content);
}

#[test]
fn still_highlights_a_regular_erb_tag_that_follows_a_comment() {
  with_color();

  let theme = get_theme(Theme::OneDark).clone();
  let comment = theme.token_html_comment_start;
  let erb_start = theme.token_erb_start;
  let keyword = theme.ruby_keyword;

  let renderer = SyntaxRenderer::with_backend(
    theme,
    StubBackend::with_tokens(vec![
      token("TOKEN_ERB_START", 0, 3),
      token("TOKEN_ERB_CONTENT", 3, 9),
      token("TOKEN_ERB_END", 9, 11),
      token("TOKEN_ERB_START", 11, 13),
      token("TOKEN_ERB_CONTENT", 13, 19),
      token("TOKEN_ERB_END", 19, 21),
    ]),
  );

  let content = "<%# note %><% if x %>";
  let result = renderer.highlight(content);

  assert!(result.contains(&colorize("<%#", comment)));
  assert!(result.contains(&colorize("<%", erb_start)));
  assert!(result.contains(&colorize("if", keyword)));
  assert_eq!(strip_ansi_colors(&result), content);
}
