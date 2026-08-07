use crate::utils::html_data::TOKEN_LIST_ATTRIBUTES;
use herb::nodes::*;
use herb::union_types::*;
use herb::Location;
use herb::Token;

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
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node)) => Some(node),
    _ => None,
  }
}

pub fn get_attributes(node: &HTMLOpenTagNode) -> Vec<&HTMLAttributeNode> {
  filter_html_attribute_nodes(&node.children)
}

pub fn filter_html_attribute_nodes(children: &[AnyNode]) -> Vec<&HTMLAttributeNode> {
  children
    .iter()
    .filter_map(|child| match child {
      AnyNode::HTMLAttributeNode(attribute) => Some(attribute.as_ref()),
      _ => None,
    })
    .collect()
}

pub fn get_open_tag_children(element: &HTMLElementNode) -> &[AnyNode] {
  match &element.open_tag {
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node)) => &node.children,
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(node)) => &node.children,
    _ => &[],
  }
}

pub fn get_open_tag_name_token(element: &HTMLElementNode) -> Option<&Token> {
  match &element.open_tag {
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node)) => node.tag_name.as_ref(),
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(node)) => node.tag_name.as_ref(),
    _ => None,
  }
}

pub fn get_element_attributes(element: &HTMLElementNode) -> Vec<&HTMLAttributeNode> {
  filter_html_attribute_nodes(get_open_tag_children(element))
}

pub fn find_attribute_by_name<'node>(attributes: &[&'node HTMLAttributeNode], attribute_name: &str) -> Option<&'node HTMLAttributeNode> {
  let lowercase = attribute_name.to_lowercase();

  attributes
    .iter()
    .copied()
    .find(|attribute| get_attribute_name(attribute).map(|name| name.to_lowercase() == lowercase).unwrap_or(false))
}

pub fn get_element_attribute<'node>(element: &'node HTMLElementNode, attribute_name: &str) -> Option<&'node HTMLAttributeNode> {
  find_attribute_by_name(&get_element_attributes(element), attribute_name)
}

pub fn has_element_attribute(element: &HTMLElementNode, attribute_name: &str) -> bool {
  get_element_attribute(element, attribute_name).is_some()
}

pub fn get_tag_local_name(element: &HTMLElementNode) -> Option<String> {
  get_tag_name_from_element(element).map(|name| name.to_lowercase())
}

pub fn element_tag_name_location(element: &HTMLElementNode) -> Location {
  element
    .tag_name
    .as_ref()
    .map(|token| token.location.clone())
    .unwrap_or_else(|| element.location.clone())
}

pub fn has_attribute_value(attribute: &HTMLAttributeNode) -> bool {
  attribute.value.is_some()
}

pub fn has_attribute(node: &HTMLOpenTagNode, attribute_name: &str) -> bool {
  get_attribute(node, attribute_name).is_some()
}

/// Finds an attribute among a tag's children, so the same lookup works for the
/// attributes Action View synthesizes onto an `ERBOpenTagNode`.
pub fn get_attribute_in<'node>(children: &'node [AnyNode], attribute_name: &str) -> Option<&'node HTMLAttributeNode> {
  let lowercase = attribute_name.to_lowercase();

  children.iter().find_map(|child| match child {
    AnyNode::HTMLAttributeNode(attribute) => get_attribute_name(attribute)
      .filter(|name| name.to_lowercase() == lowercase)
      .map(|_| attribute.as_ref()),
    _ => None,
  })
}

pub fn has_attribute_in(children: &[AnyNode], attribute_name: &str) -> bool {
  get_attribute_in(children, attribute_name).is_some()
}

pub fn get_attribute<'node>(node: &'node HTMLOpenTagNode, attribute_name: &str) -> Option<&'node HTMLAttributeNode> {
  let lowercase = attribute_name.to_lowercase();
  get_attributes(node)
    .into_iter()
    .find(|attribute| get_attribute_name(attribute).map(|name| name.to_lowercase() == lowercase).unwrap_or(false))
}

pub fn get_attribute_name(attribute: &HTMLAttributeNode) -> Option<String> {
  Some(get_static_attribute_name(attribute)?.to_lowercase())
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
    if value_node.quoted {
      result.push_str(value_node.open_quote.as_ref().map(|token| token.value.as_str()).unwrap_or("\""));
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

        // `action_view_helpers` can parse ERB inside a value into a whole
        // element, so anything else is printed back the way it was written
        other => result.push_str(&herb_printer::IdentityPrinter::print_nodes(std::slice::from_ref(other))),
      }
    }
    if value_node.quoted {
      result.push_str(value_node.close_quote.as_ref().map(|token| token.value.as_str()).unwrap_or("\""));
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

pub fn is_erb_output_node(node: &ERBContentNode) -> bool {
  node
    .tag_opening
    .as_ref()
    .map(|token| token.value == "<%=" || token.value == "<%==")
    .unwrap_or(false)
}

pub fn has_erb_output(children: &[AnyNode]) -> bool {
  children.iter().any(|child| match child {
    AnyNode::ERBContentNode(erb) => is_erb_output_node(erb),
    _ => false,
  })
}

pub fn is_effectively_static(children: &[AnyNode]) -> bool {
  !has_erb_output(children)
}

pub fn get_validatable_static_content(children: &[AnyNode]) -> Option<String> {
  if has_erb_output(children) {
    return None;
  }

  Some(
    children
      .iter()
      .filter_map(|child| match child {
        AnyNode::LiteralNode(literal) => Some(literal.content.as_str()),
        _ => None,
      })
      .collect(),
  )
}

pub fn get_static_string_from_nodes(children: &[AnyNode]) -> Option<String> {
  if !children.iter().all(|child| matches!(child, AnyNode::LiteralNode(_))) {
    return None;
  }

  Some(
    children
      .iter()
      .filter_map(|child| match child {
        AnyNode::LiteralNode(literal) => Some(literal.content.as_str()),
        _ => None,
      })
      .collect(),
  )
}

pub fn get_static_attribute_name(attribute: &HTMLAttributeNode) -> Option<String> {
  get_static_string_from_nodes(&attribute.name.as_ref()?.children)
}

pub fn print_output_content(children: &[AnyNode]) -> String {
  let mut result = String::new();

  for child in children {
    match child {
      AnyNode::LiteralNode(literal) => result.push_str(&literal.content),

      AnyNode::ERBContentNode(erb) if is_erb_output_node(erb) => {
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

      // Action View helpers leave interpolation behind as a `RubyLiteralNode`,
      // which prints back as the `#{...}` it came from
      AnyNode::RubyLiteralNode(literal) => {
        result.push('#');
        result.push('{');
        result.push_str(&literal.content);
        result.push('}');
      }

      _ => {}
    }
  }

  result
}

pub fn get_static_body_text(children: &[AnyNode]) -> Option<String> {
  if has_erb_output(children) {
    return None;
  }

  let literals = children.iter().filter_map(|child| match child {
    AnyNode::LiteralNode(literal) => Some(literal.content.as_str()),
    _ => None,
  });

  let texts = children.iter().filter_map(|child| match child {
    AnyNode::HTMLTextNode(text) => Some(text.content.as_str()),
    _ => None,
  });

  Some(literals.chain(texts).collect())
}

pub fn has_dynamic_attribute_value(attribute: &HTMLAttributeNode) -> bool {
  attribute
    .value
    .as_ref()
    .map(|value_node| value_node.children.iter().any(|child| matches!(child, AnyNode::ERBContentNode(_))))
    .unwrap_or(false)
}

pub fn get_attribute_value(attribute: &HTMLAttributeNode) -> Option<String> {
  let value_node = attribute.value.as_ref()?;

  if value_node.children.is_empty() {
    return None;
  }

  let mut result = String::new();

  for child in &value_node.children {
    match child {
      AnyNode::ERBContentNode(erb) => {
        if let Some(ref content) = erb.content {
          result.push_str(erb.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or(""));
          result.push_str(&content.value);
          result.push_str(erb.tag_closing.as_ref().map(|token| token.value.as_str()).unwrap_or(""));
        }
      }

      AnyNode::LiteralNode(literal) => result.push_str(&literal.content),

      _ => {}
    }
  }

  Some(result)
}

pub fn get_element_static_attribute_value(element: &HTMLElementNode, attribute_name: &str) -> Option<String> {
  get_static_attribute_value(get_element_attribute(element, attribute_name)?)
}

fn token_list(value: Option<&str>) -> Vec<&str> {
  value.map(|value| value.split_whitespace().collect()).unwrap_or_default()
}

pub fn is_equivalent_attribute(first: &HTMLAttributeNode, second: &HTMLAttributeNode) -> bool {
  let first_name = get_attribute_name(first);

  if first_name != get_attribute_name(second) {
    return false;
  }

  let first_value = get_attribute_value(first);
  let second_value = get_attribute_value(second);

  if let Some(ref name) = first_name {
    if TOKEN_LIST_ATTRIBUTES.contains(&name.as_str()) {
      let mut first_tokens = token_list(first_value.as_deref());
      let mut second_tokens = token_list(second_value.as_deref());

      if first_tokens.len() != second_tokens.len() {
        return false;
      }

      first_tokens.sort_unstable();
      second_tokens.sort_unstable();

      return first_tokens == second_tokens;
    }
  }

  first_value == second_value
}

pub fn is_equivalent_open_tag(first: &HTMLOpenTagNode, second: &HTMLOpenTagNode) -> bool {
  let first_tag_name = first.tag_name.as_ref().map(|token| token.value.as_str());
  let second_tag_name = second.tag_name.as_ref().map(|token| token.value.as_str());

  if first_tag_name != second_tag_name {
    return false;
  }

  let first_attributes = get_attributes(first);
  let second_attributes = get_attributes(second);

  if first_attributes.len() != second_attributes.len() {
    return false;
  }

  first_attributes
    .iter()
    .all(|attribute| second_attributes.iter().any(|other| is_equivalent_attribute(attribute, other)))
}

pub fn is_equivalent_element(first: &HTMLElementNode, second: &HTMLElementNode) -> bool {
  match (get_open_tag(first), get_open_tag(second)) {
    (Some(first_open_tag), Some(second_open_tag)) => is_equivalent_open_tag(first_open_tag, second_open_tag),
    _ => false,
  }
}

pub fn element_has_aria_hidden(element: &HTMLElementNode) -> bool {
  match get_element_attribute(element, "aria-hidden") {
    None => false,
    Some(attribute) => match get_static_attribute_value(attribute) {
      None => true,
      Some(value) => value == "true",
    },
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

pub fn open_tag_location(element: &HTMLElementNode) -> Location {
  match &element.open_tag {
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node)) => node.location.clone(),
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(node)) => node.location.clone(),
    Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLConditionalOpenTagNode(node)) => node.location.clone(),
    None => element.location.clone(),
  }
}

const NON_JS_SCRIPT_TYPES: &[&str] = &["application/json", "application/ld+json", "text/template", "text/html", "text/x-template"];

pub fn is_javascript_tag_element(element: &HTMLElementNode) -> bool {
  let type_attribute = match get_element_attribute(element, "type") {
    Some(attribute) => attribute,
    None => return true,
  };

  match get_static_attribute_value(type_attribute) {
    None => true,
    Some(value) => !NON_JS_SCRIPT_TYPES.contains(&value.to_lowercase().as_str()),
  }
}
