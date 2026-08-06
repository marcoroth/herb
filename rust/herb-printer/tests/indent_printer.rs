use herb_printer::IndentPrinter;

fn print_indented(source: &str, width: usize) -> String {
  let options = herb::ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };
  let result = herb::parse_with_options(source, &options).unwrap();

  IndentPrinter::print_with_width(&result.value, width)
}

#[test]
fn flat_element_prints_unchanged() {
  assert_eq!(print_indented("<div>Hello</div>", 2), "<div>Hello</div>");
}

#[test]
fn self_closing_element_prints_unchanged() {
  assert_eq!(print_indented("<br />", 2), "<br />");
}

#[test]
fn nested_elements_get_reindented() {
  let input = "<div>\n    <p>\n        Hello\n    </p>\n</div>\n";
  let expected = "<div>\n  <p>\n    Hello\n  </p>\n</div>\n";

  assert_eq!(print_indented(input, 2), expected);
}

#[test]
fn deeply_nested_elements() {
  let input = "<div>\n      <ul>\n            <li>\n                  Hello\n            </li>\n      </ul>\n</div>\n";
  let expected = "<div>\n  <ul>\n    <li>\n      Hello\n    </li>\n  </ul>\n</div>\n";

  assert_eq!(print_indented(input, 2), expected);
}

#[test]
fn indent_width_of_four() {
  let input = "<div>\n  <p>\n    Hello\n  </p>\n</div>\n";
  let expected = "<div>\n    <p>\n        Hello\n    </p>\n</div>\n";

  assert_eq!(print_indented(input, 4), expected);
}

#[test]
fn whitespace_only_lines_become_empty() {
  let input = "<div>\n   \n  <p>Hello</p>\n</div>";
  let expected = "<div>\n\n  <p>Hello</p>\n</div>";

  assert_eq!(print_indented(input, 2), expected);
}

#[test]
fn default_width_is_two() {
  let input = "<div>\n    <p>Hello</p>\n</div>\n";
  let expected = "<div>\n  <p>Hello</p>\n</div>\n";

  let options = herb::ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };
  let result = herb::parse_with_options(input, &options).unwrap();

  assert_eq!(IndentPrinter::print_document(&result.value), expected);
}
