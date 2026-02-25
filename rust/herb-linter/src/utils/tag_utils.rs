use herb::nodes::*;
use herb::union_types::*;
use herb::Location;

pub fn tag_name_location(node: &HTMLOpenTagNode) -> Location {
  node
    .tag_name
    .as_ref()
    .map(|token| token.location.clone())
    .unwrap_or_else(|| node.location.clone())
}

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

pub fn get_attribute<'node>(node: &'node HTMLOpenTagNode, attribute_name: &str) -> Option<&'node HTMLAttributeNode> {
  let lowercase = attribute_name.to_lowercase();
  get_attributes(node)
    .into_iter()
    .find(|attribute| get_attribute_name(attribute).map(|name| name.to_lowercase() == lowercase).unwrap_or(false))
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

// TODO: use IdentityPrinter from herb-printer to print the attribute name node
pub fn print_attribute_name(attribute: &HTMLAttributeNode) -> String {
  let name_node = match &attribute.name {
    Some(name_node) => name_node,
    None => return String::new(),
  };

  let mut result = String::new();

  for child in &name_node.children {
    match child {
      AnyNode::LiteralNode(literal) => result.push_str(&literal.content),
      AnyNode::ERBContentNode(erb) => {
        if let Some(ref opening) = erb.tag_opening {
          result.push_str(&opening.value);
        }

        if let Some(ref content) = erb.content {
          result.push_str(&content.value);
        }

        if let Some(ref closing) = erb.tag_closing {
          result.push_str(&closing.value);
        }
      }
      _ => {}
    }
  }

  result
}

// TODO: use IdentityPrinter from herb-printer to print the attribute node
pub fn print_attribute(attribute: &HTMLAttributeNode) -> String {
  let mut result = print_attribute_name(attribute);

  if let Some(ref equals) = attribute.equals {
    result.push_str(&equals.value);
  }

  if let Some(ref value_node) = attribute.value {
    if let Some(ref open_quote) = value_node.open_quote {
      result.push_str(&open_quote.value);
    }

    for child in &value_node.children {
      match child {
        AnyNode::LiteralNode(literal) => result.push_str(&literal.content),
        AnyNode::ERBContentNode(erb) => {
          if let Some(ref opening) = erb.tag_opening {
            result.push_str(&opening.value);
          }

          if let Some(ref content) = erb.content {
            result.push_str(&content.value);
          }

          if let Some(ref closing) = erb.tag_closing {
            result.push_str(&closing.value);
          }
        }
        _ => {}
      }
    }
    if let Some(ref close_quote) = value_node.close_quote {
      result.push_str(&close_quote.value);
    }
  }

  result
}

pub fn get_attribute_name_literal_content(attribute: &HTMLAttributeNode) -> Option<String> {
  if let Some(name) = get_attribute_name(attribute) {
    return Some(name.to_string());
  }

  let name_node = attribute.name.as_ref()?;
  let mut result = String::new();
  let mut has_literal = false;

  for child in &name_node.children {
    if let AnyNode::LiteralNode(literal) = child {
      result.push_str(&literal.content);
      has_literal = true;
    }
  }

  if has_literal {
    Some(result)
  } else {
    None
  }
}

pub fn get_combined_attribute_name(attribute: &HTMLAttributeNode) -> Option<String> {
  let name_node = attribute.name.as_ref()?;
  let mut result = String::new();
  let mut has_content = false;

  for child in &name_node.children {
    match child {
      AnyNode::LiteralNode(literal) => {
        result.push_str(&literal.content);
        has_content = true;
      }

      AnyNode::ERBContentNode(_) => {
        has_content = true;
      }
      _ => {}
    }
  }

  if has_content {
    Some(result)
  } else {
    None
  }
}

pub fn has_aria_hidden(node: &HTMLOpenTagNode) -> bool {
  match get_attribute(node, "aria-hidden") {
    None => false,
    Some(attribute) => match get_static_attribute_value(attribute) {
      None => true,
      Some(value) => value.is_empty() || value == "true",
    },
  }
}

pub fn has_aria_hidden_true(node: &HTMLOpenTagNode) -> bool {
  get_attribute(node, "aria-hidden")
    .and_then(|attribute| get_static_attribute_value(attribute))
    .map(|value| value == "true")
    .unwrap_or(false)
}
