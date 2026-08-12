mod common;

use std::sync::Arc;

use herb_highlighter::ansi::find_ansi_sequences;
use herb_highlighter::herb_backend::Herb;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, token, with_color, StubBackend};

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
