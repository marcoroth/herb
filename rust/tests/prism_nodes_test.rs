mod common;

use herb::{parse_with_options, ParserOptions};
use insta::assert_snapshot;

fn options() -> ParserOptions {
  ParserOptions {
    prism_nodes: true,
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
fn test_expression_tag_with_method_call() {
  common::no_color();
  let result = parse_with_options("<%= user.name %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_expression_tag_with_instance_variable() {
  common::no_color();
  let result = parse_with_options("<%= @name %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_non_output_tag_with_assignment() {
  common::no_color();
  let result = parse_with_options("<% x = 1 %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_if_statement() {
  common::no_color();
  let result = parse_with_options(r#"<% if true %><%= "yes" %><% end %>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_if_else_statement() {
  common::no_color();
  let result = parse_with_options(r#"<% if admin? %><%= "admin" %><% else %><%= "user" %><% end %>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_if_elsif_else_statement() {
  common::no_color();
  let result = parse_with_options("<% if a? %>A<% elsif b? %>B<% else %>C<% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_unless_statement() {
  common::no_color();
  let result = parse_with_options("<% unless hidden? %><%= content %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_each_block() {
  common::no_color();
  let result = parse_with_options("<% items.each do |item| %><%= item %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_while_loop() {
  common::no_color();
  let result = parse_with_options("<% while running? %><%= status %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_until_loop() {
  common::no_color();
  let result = parse_with_options("<% until done? %><%= progress %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_for_loop() {
  common::no_color();
  let result = parse_with_options("<% for item in items %><%= item %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_case_when() {
  common::no_color();
  let result = parse_with_options(
    r#"<% case role %><% when "admin" %><%= "Admin" %><% when "user" %><%= "User" %><% end %>"#,
    &options(),
  )
  .unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_begin_rescue() {
  common::no_color();
  let result = parse_with_options(r#"<% begin %><%= dangerous_call %><% rescue %><%= "error" %><% end %>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_nested_if_inside_each() {
  common::no_color();
  let result = parse_with_options("<% items.each do |item| %><% if item.visible? %><%= item.name %><% end %><% end %>", &options()).unwrap();
  assert_snapshot!(result.inspect());
}

#[test]
fn test_expression_inside_html() {
  common::no_color();
  let result = parse_with_options(r#"<div class="<%= css_class %>"><%= content %></div>"#, &options()).unwrap();
  assert_snapshot!(result.inspect());
}
