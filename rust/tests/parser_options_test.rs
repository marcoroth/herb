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

#[test]
fn test_ruby_version_selects_the_ruby_syntax() {
  common::no_color();

  let source = "<% def greet(name,) = name %>";

  assert!(parse(source).unwrap().success());

  let options = ParserOptions {
    ruby_version: Some("3.4".to_string()),
    ..ParserOptions::default()
  };
  let result = parse_with_options(source, &options).unwrap();
  let messages: Vec<&str> = result.recursive_errors().iter().map(|error| error.message()).collect();

  assert_eq!(messages, vec!["parameter_wild_loose_comma: unexpected `,` in parameters"]);
}

#[test]
fn test_unsupported_ruby_version_is_an_error() {
  let options = ParserOptions {
    ruby_version: Some("2.7".to_string()),
    ..ParserOptions::default()
  };

  let error = parse_with_options("<%= user %>", &options).err();

  assert_eq!(error.as_deref(), Some("ruby_version \"2.7\" is not supported"));
}
