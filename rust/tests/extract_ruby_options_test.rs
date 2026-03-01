use herb::{extract_ruby, extract_ruby_with_options, ExtractRubyOptions};

#[test]
fn test_extract_ruby_default() {
  let source = "<% x = 1 %> <% y = 2 %>";
  let result = extract_ruby(source).unwrap();
  assert_eq!(result, "   x = 1  ;    y = 2  ;");
}

#[test]
fn test_extract_ruby_without_semicolons() {
  let source = "<% x = 1 %> <% y = 2 %>";
  let options = ExtractRubyOptions {
    semicolons: false,
    ..Default::default()
  };
  let result = extract_ruby_with_options(source, &options).unwrap();
  assert_eq!(result, "   x = 1       y = 2   ");
}

#[test]
fn test_extract_ruby_with_comments() {
  let source = "<%# comment %>\n<% code %>";
  let options = ExtractRubyOptions {
    comments: true,
    ..Default::default()
  };
  let result = extract_ruby_with_options(source, &options).unwrap();
  assert_eq!(result, "  # comment   \n   code  ;");
}

#[test]
fn test_extract_ruby_without_preserve_positions() {
  let source = "<% x = 1 %> <% y = 2 %>";
  let options = ExtractRubyOptions {
    preserve_positions: false,
    ..Default::default()
  };
  let result = extract_ruby_with_options(source, &options).unwrap();
  assert_eq!(result, " x = 1 \n y = 2 ");
}

#[test]
fn test_extract_ruby_without_preserve_positions_with_comments() {
  let source = "<%# comment %><%= something %>";
  let options = ExtractRubyOptions {
    preserve_positions: false,
    comments: true,
    ..Default::default()
  };
  let result = extract_ruby_with_options(source, &options).unwrap();
  assert_eq!(result, "# comment \n something ");
}
