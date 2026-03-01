mod common;

use herb::parse;

#[test]
fn test_parse_result_success_with_valid_html() {
  common::no_color();

  let source = "<div>Hello</div>";
  let result = parse(source).unwrap();

  assert!(result.success(), "Expected success() to be true for valid HTML");
  assert!(!result.failed(), "Expected failed() to be false for valid HTML");
  assert!(result.errors().is_empty(), "Expected no errors for valid HTML");
}

#[test]
fn test_parse_result_failed_with_unclosed_element() {
  common::no_color();

  let source = "<div class=\"test\">";
  let result = parse(source).unwrap();

  assert!(!result.success(), "Expected success() to be false for invalid HTML");
  assert!(result.failed(), "Expected failed() to be true for invalid HTML");
  assert!(!result.recursive_errors().is_empty(), "Expected errors for invalid HTML");

  let errors = result.recursive_errors();

  assert!(errors.iter().any(|e| e.error_type() == "MISSING_CLOSING_TAG_ERROR"));
}

#[test]
fn test_parse_result_failed_with_tag_mismatch() {
  common::no_color();

  let source = "<div></span>";
  let result = parse(source).unwrap();

  assert!(!result.success(), "Expected success() to be false for mismatched tags");
  assert!(result.failed(), "Expected failed() to be true for mismatched tags");

  let errors = result.recursive_errors();

  assert!(!errors.is_empty(), "Expected errors for mismatched tags");
  assert!(errors.iter().any(|e| e.error_type() == "MISSING_OPENING_TAG_ERROR"));
  assert!(errors.iter().any(|e| e.error_type() == "MISSING_CLOSING_TAG_ERROR"));
}

#[test]
fn test_parse_result_errors_are_recursive() {
  common::no_color();

  let source = "<div><span></div></span>";
  let result = parse(source).unwrap();
  let errors = result.recursive_errors();

  assert!(!errors.is_empty(), "Expected recursive errors to be collected");
  assert!(result.failed(), "Expected failed() to be true when there are recursive errors");
}
