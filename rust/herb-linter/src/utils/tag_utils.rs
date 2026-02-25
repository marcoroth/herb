use herb::nodes::*;
use herb::union_types::*;

pub fn get_tag_name_from_open_tag(node: &HTMLOpenTagNode) -> Option<&str> {
  node.tag_name.as_ref().map(|token| token.value.as_str())
}

pub fn get_tag_name_from_close_tag(node: &HTMLCloseTagNode) -> Option<&str> {
  node.tag_name.as_ref().map(|token| token.value.as_str())
}

pub fn get_tag_name_from_element(node: &HTMLElementNode) -> Option<&str> {
  node.tag_name.as_ref().map(|token| token.value.as_str())
}

pub fn get_open_tag(element: &HTMLElementNode) -> Option<&HTMLOpenTagNode> {
  match &element.open_tag {
    Some(HTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node)) => Some(node),
    _ => None,
  }
}

pub fn get_attributes(node: &HTMLOpenTagNode) -> Vec<&HTMLAttributeNode> {
  node
    .children
    .iter()
    .filter_map(|child| match child {
      AnyNode::HTMLAttributeNode(attribute) => Some(attribute),
      _ => None,
    })
    .collect()
}

pub fn has_attribute(node: &HTMLOpenTagNode, attribute_name: &str) -> bool {
  get_attribute(node, attribute_name).is_some()
}

pub fn get_attribute<'node>(
  node: &'node HTMLOpenTagNode,
  attribute_name: &str,
) -> Option<&'node HTMLAttributeNode> {
  let lowercase = attribute_name.to_lowercase();
  get_attributes(node).into_iter().find(|attribute| {
    get_attribute_name(attribute)
      .map(|name| name.to_lowercase() == lowercase)
      .unwrap_or(false)
  })
}

pub fn get_attribute_name(attribute: &HTMLAttributeNode) -> Option<&str> {
  let name_node = attribute.name.as_ref()?;
  if name_node.children.len() == 1 {
    if let AnyNode::LiteralNode(literal) = &name_node.children[0] {
      return Some(literal.content.as_str());
    }
  }
  None
}

pub fn get_static_attribute_value(attribute: &HTMLAttributeNode) -> Option<String> {
  let value_node = attribute.value.as_ref()?;
  let mut result = String::new();
  for child in &value_node.children {
    match child {
      AnyNode::LiteralNode(literal) => result.push_str(&literal.content),
      _ => return None,
    }
  }
  Some(result)
}
