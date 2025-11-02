use herb::parse;

#[test]
fn test_open_tag_field_is_displayed() {
  let source = "<div class=\"test\">Hello</div>";
  let result = parse(source).unwrap();

  assert!(result.tree_inspect.contains("open_tag:"));
  assert!(result.tree_inspect.contains("@ HTMLOpenTagNode"));
  assert!(result.tree_inspect.contains("tag_opening: \"<\""));
  assert!(result.tree_inspect.contains("tag_name: \"div\""));

  assert!(result.tree_inspect.contains("close_tag:"));
  assert!(result.tree_inspect.contains("@ HTMLCloseTagNode"));
  assert!(result.tree_inspect.contains("tag_opening: \"</\""));
}

#[test]
fn test_nested_node_fields() {
  let source = "<div class=\"test\">Hello</div>";
  let result = parse(source).unwrap();

  assert!(result.tree_inspect.contains("@ HTMLAttributeNode"));
  assert!(result.tree_inspect.contains("name:"));
  assert!(result.tree_inspect.contains("@ HTMLAttributeNameNode"));
  assert!(result.tree_inspect.contains("value:"));
  assert!(result.tree_inspect.contains("@ HTMLAttributeValueNode"));
}
