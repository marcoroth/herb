use herb::{extract_html, extract_ruby, herb_version, lex, parse, prism_version, version};

const TEST_INPUT: &str = include_str!("./fixtures/test.html.erb");

#[test]
fn test_version_output() {
  let output = version();

  insta::assert_snapshot!(output);
}

#[test]
fn test_herb_version_output() {
  let output = herb_version();

  insta::assert_snapshot!(output);
}

#[test]
fn test_prism_version_output() {
  let output = prism_version();

  insta::assert_snapshot!(output);
}

#[test]
fn test_lex_output() {
  let result = lex(TEST_INPUT);
  let output = result
    .tokens()
    .iter()
    .map(|token| token.inspect())
    .collect::<Vec<_>>()
    .join("\n");

  insta::assert_snapshot!(output);
}

#[test]
fn test_parse_output() {
  let result = parse(TEST_INPUT).expect("Failed to parse");
  let output = result.tree_inspect();

  insta::assert_snapshot!(output);
}

#[test]
fn test_extract_ruby_output() {
  let result = extract_ruby(TEST_INPUT).expect("Failed to extract Ruby");

  insta::assert_snapshot!(result);
}

#[test]
fn test_extract_html_output() {
  let result = extract_html(TEST_INPUT).expect("Failed to extract HTML");

  insta::assert_snapshot!(result);
}
