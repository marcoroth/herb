use herb::parse_ruby;
use insta::assert_snapshot;

#[test]
fn test_parse_ruby_class() {
  let result = parse_ruby("class Foo; end").unwrap();
  assert_snapshot!(result.prettyprint());
}

#[test]
fn test_parse_ruby_method_definition() {
  let result = parse_ruby("def greet(name)\n  \"Hello, #{name}!\"\nend").unwrap();
  assert_snapshot!(result.prettyprint());
}

#[test]
fn test_parse_ruby_simple_expression() {
  let result = parse_ruby("1 + 2").unwrap();
  assert_snapshot!(result.prettyprint());
}
