mod common;

use herb::parse;

#[test]
fn test_unclosed_element_error() {
  common::no_color();

  let source = "<div class=\"test\">";
  let result = parse(source).unwrap();

  let tree_inspect = result.inspect();

  assert!(tree_inspect.contains("MissingClosingTagError"));
  assert!(tree_inspect.contains("Opening tag `<div>` at (1:1) doesn't have a matching closing"));
}

#[test]
fn test_tag_names_mismatch_error() {
  common::no_color();

  let source = "<div></span>";
  let result = parse(source).unwrap();
  let tree_inspect = result.inspect();

  print!("{}", tree_inspect);

  assert!(tree_inspect.contains("MissingClosingTagError (location: (1:0)-(1:5))"));
  assert!(tree_inspect.contains("Opening tag `<div>` at (1:1) doesn't have a matching closing tag `</div>` in the same scope."));

  assert!(tree_inspect.contains("MissingOpeningTagError (location: (1:5)-(1:12))"));
  assert!(tree_inspect.contains("Found closing tag `</span>` at (1:7) without a matching opening tag in the same scope."));
}

#[test]
fn test_no_errors_with_valid_html() {
  common::no_color();

  let source = "<div>Hello</div>";
  let result = parse(source).unwrap();
  let tree_inspect = result.inspect();

  assert!(!tree_inspect.contains("error"));
  assert!(!tree_inspect.contains("ERROR"));
}
