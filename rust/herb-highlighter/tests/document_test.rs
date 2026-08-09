mod common;

use std::sync::Arc;

use herb_highlighter::document::{StyleRole, StyledRun};
use herb_highlighter::herb_backend::Herb;
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{with_color, StubBackend};

fn renderer(theme: Theme) -> SyntaxRenderer {
  SyntaxRenderer::with_backend(get_theme(theme).clone(), Arc::new(Herb))
}

fn role_label(role: &StyleRole) -> String {
  match role {
    StyleRole::Plain => "Plain".to_string(),
    StyleRole::Token(token_type) => format!("Token({token_type})"),
    StyleRole::RubyKeyword => "RubyKeyword".to_string(),
    StyleRole::TagName => "TagName".to_string(),
    StyleRole::AttributeName => "AttributeName".to_string(),
    StyleRole::AttributeValue => "AttributeValue".to_string(),
    StyleRole::CommentInterior => "CommentInterior".to_string(),
  }
}

fn escape_text(text: &str) -> String {
  text.replace('\\', "\\\\").replace('\n', "\\n")
}

fn serialize_runs(runs: &[StyledRun]) -> String {
  runs
    .iter()
    .map(|run| format!("{}|{}", role_label(&run.role), escape_text(&run.text)))
    .collect::<Vec<_>>()
    .join("\n")
}

#[test]
fn serializes_styled_runs_for_a_mixed_fixture() {
  with_color();

  let content = "<div class=\"a\">\n  <!-- note -->\n  <% if x %>ok<%= y %>\n</div>";

  insta::assert_snapshot!(serialize_runs(&renderer(Theme::OneDark).highlight_runs(content)));
}

#[test]
fn lex_failure_produces_a_single_plain_run() {
  with_color();

  let failing_renderer = SyntaxRenderer::with_backend(get_theme(Theme::OneDark).clone(), StubBackend::failing());

  let content = "<invalid>";

  assert_eq!(
    failing_renderer.highlight_runs(content),
    vec![StyledRun {
      text: content.to_string(),
      role: StyleRole::Plain,
    }]
  );
}

#[test]
fn empty_content_produces_no_runs() {
  with_color();

  assert_eq!(renderer(Theme::OneDark).highlight_runs(""), Vec::new());
}
