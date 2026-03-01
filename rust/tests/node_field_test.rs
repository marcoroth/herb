mod common;

use herb::parse;

#[test]
fn test_open_tag_field_is_displayed() {
  common::no_color();

  let source = "<div class=\"test\">Hello</div>";
  let result = parse(source).unwrap();

  let tree_inspect = result.inspect();
  assert!(tree_inspect.contains("open_tag:"));
  assert!(tree_inspect.contains("@ HTMLOpenTagNode"));
  assert!(tree_inspect.contains("tag_opening: \"<\""));
  assert!(tree_inspect.contains("tag_name: \"div\""));

  assert!(tree_inspect.contains("close_tag:"));
  assert!(tree_inspect.contains("@ HTMLCloseTagNode"));
  assert!(tree_inspect.contains("tag_opening: \"</\""));
}

#[test]
fn test_nested_node_fields() {
  common::no_color();

  let source = "<div class=\"test\">Hello</div>";
  let result = parse(source).unwrap();

  let tree_inspect = result.inspect();
  assert!(tree_inspect.contains("@ HTMLAttributeNode"));
  assert!(tree_inspect.contains("name:"));
  assert!(tree_inspect.contains("@ HTMLAttributeNameNode"));
  assert!(tree_inspect.contains("value:"));
  assert!(tree_inspect.contains("@ HTMLAttributeValueNode"));
}
