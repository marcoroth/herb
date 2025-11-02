use herb::parse;

#[test]
fn test_unclosed_element_error() {
  let source = "<div class=\"test\">";
  let result = parse(source).unwrap();

  let tree_inspect = result.tree_inspect();
  assert!(tree_inspect.contains("UNCLOSED_ELEMENT_ERROR"));
  assert!(tree_inspect.contains("Tag `<div>` opened at (1:1) was never closed"));
  assert!(tree_inspect.contains("MISSING_CLOSING_TAG_ERROR"));
  assert!(tree_inspect.contains("Opening tag `<div>` at (1:1) doesn't have a matching closing tag"));
}

#[test]
fn test_tag_names_mismatch_error() {
  let source = "<div></span>";
  let result = parse(source).unwrap();

  let tree_inspect = result.tree_inspect();
  assert!(tree_inspect.contains("TAG_NAMES_MISMATCH_ERROR"));
  assert!(tree_inspect.contains("Opening tag `<div>` at (1:1) closed with `</span>`"));
}

#[test]
fn test_no_errors_with_valid_html() {
  let source = "<div>Hello</div>";
  let result = parse(source).unwrap();

  let tree_inspect = result.tree_inspect();
  assert!(!tree_inspect.contains("error"));
  assert!(!tree_inspect.contains("ERROR"));
}
