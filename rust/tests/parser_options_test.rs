mod common;

use herb::{parse, parse_with_options, ParserOptions};

#[test]
fn test_track_whitespace_disabled_by_default() {
  common::no_color();

  let source = r#"<div     class="example">content</div>"#;
  let result = parse(source).unwrap();
  let output = result.inspect();

  assert!(
    !output.contains("WhitespaceNode"),
    "Expected no WhitespaceNode with track_whitespace disabled (default)"
  );
}

#[test]
fn test_track_whitespace_enabled_tracks_whitespace() {
  common::no_color();

  let source = r#"<div     class="example">content</div>"#;
  let options = ParserOptions {
    track_whitespace: true,
    ..ParserOptions::default()
  };
  let result = parse_with_options(source, &options).unwrap();
  let output = result.inspect();

  assert!(output.contains("WhitespaceNode"), "Expected WhitespaceNode with track_whitespace enabled");
}

#[test]
fn test_analyze_enabled_by_default_transforms_erb_nodes() {
  common::no_color();

  let source = "<% if true %>true<% end %>";
  let result = parse(source).unwrap();
  let output = result.inspect();

  assert!(output.contains("ERBIfNode"), "Expected ERBIfNode with analyze enabled (default)");
  assert!(!output.contains("ERBContentNode"), "Expected no ERBContentNode with analyze enabled (default)");
}

#[test]
fn test_analyze_disabled_skips_erb_node_transformation() {
  common::no_color();

  let source = "<% if true %>true<% end %>";
  let options = ParserOptions {
    analyze: false,
    ..ParserOptions::default()
  };
  let result = parse_with_options(source, &options).unwrap();
  let output = result.inspect();

  assert!(output.contains("ERBContentNode"), "Expected ERBContentNode with analyze disabled");
  assert!(!output.contains("ERBIfNode"), "Expected no ERBIfNode with analyze disabled");
}
