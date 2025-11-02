use herb::parse;

#[test]
fn test_unclosed_element_error() {
  let source = "<div class=\"test\">";
  let result = parse(source).unwrap();

  assert!(result.tree_inspect.contains("UNCLOSED_ELEMENT_ERROR"));
  assert!(result
    .tree_inspect
    .contains("Tag `<div>` opened at (1:1) was never closed"));
  assert!(result.tree_inspect.contains("MISSING_CLOSING_TAG_ERROR"));
  assert!(result
    .tree_inspect
    .contains("Opening tag `<div>` at (1:1) doesn't have a matching closing tag"));
}

#[test]
fn test_tag_names_mismatch_error() {
  let source = "<div></span>";
  let result = parse(source).unwrap();

  assert!(result.tree_inspect.contains("TAG_NAMES_MISMATCH_ERROR"));
  assert!(result
    .tree_inspect
    .contains("Opening tag `<div>` at (1:1) closed with `</span>`"));
}

#[test]
fn test_no_errors_with_valid_html() {
  let source = "<div>Hello</div>";
  let result = parse(source).unwrap();

  assert!(!result.tree_inspect.contains("error"));
  assert!(!result.tree_inspect.contains("ERROR"));
}
