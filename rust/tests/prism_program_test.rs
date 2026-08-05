mod common;

use herb::{parse_with_options, ParserOptions};
use insta::assert_snapshot;

fn options() -> ParserOptions {
  ParserOptions {
    prism_nodes: true,
    prism_program: true,
    ..ParserOptions::default()
  }
}

#[test]
fn test_expression_tag_with_string() {
  common::no_color();
  let result = parse_with_options(r#"<%= "hello" %>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_if_statement() {
  common::no_color();
  let result = parse_with_options(r#"<% if true %><%= "yes" %><% end %>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}
