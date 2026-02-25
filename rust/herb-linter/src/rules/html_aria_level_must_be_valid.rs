use crate::utils::tag_utils::{get_attribute, get_static_attribute_value};

use herb::nodes::{AnyNode, HTMLAttributeNode, HTMLOpenTagNode};
use herb::Visitor;

fn has_erb_output(attribute: &HTMLAttributeNode) -> bool {
  let value_node = match &attribute.value {
    Some(value_node) => value_node,
    None => return false,
  };

  value_node.children.iter().any(|child| {
    if let AnyNode::ERBContentNode(erb) = child {
      erb.tag_opening.as_ref().map(|tag| tag.value == "<%=" || tag.value == "<%==").unwrap_or(false)
    } else {
      false
    }
  })
}

fn get_validatable_static_content(attribute: &HTMLAttributeNode) -> Option<String> {
  let value_node = match &attribute.value {
    Some(value_node) => value_node,
    None => return None,
  };

  let mut result = String::new();

  for child in &value_node.children {
    match child {
      AnyNode::LiteralNode(literal) => result.push_str(&literal.content),
      AnyNode::ERBContentNode(erb) => {
        if let Some(ref tag) = erb.tag_opening {
          if tag.value == "<%=" || tag.value == "<%==" {
            return None;
          }
        }
      }

      _ => return None,
    }
  }

  Some(result)
}

fn get_mixed_content_parts(attribute: &HTMLAttributeNode) -> Option<(String, String)> {
  let value_node = match &attribute.value {
    Some(value_node) => value_node,
    None => return None,
  };

  let mut static_part = String::new();
  let mut erb_text = String::new();
  let mut has_literal = false;
  let mut has_erb_output = false;

  for child in &value_node.children {
    match child {
      AnyNode::LiteralNode(literal) => {
        static_part.push_str(&literal.content);
        has_literal = true;
      }

      AnyNode::ERBContentNode(erb) => {
        let is_output = erb.tag_opening.as_ref().map(|tag| tag.value == "<%=" || tag.value == "<%==").unwrap_or(false);

        if is_output && erb_text.is_empty() {
          if let Some(ref opening) = erb.tag_opening {
            erb_text.push_str(&opening.value);
          }

          if let Some(ref content) = erb.content {
            erb_text.push_str(&content.value);
          }

          if let Some(ref closing) = erb.tag_closing {
            erb_text.push_str(&closing.value);
          }

          has_erb_output = true;
        }
      }
      _ => {}
    }
  }

  if has_literal && has_erb_output {
    Some((static_part, erb_text))
  } else {
    None
  }
}

rule_visitor!(AriaLevelMustBeValidVisitor);
define_parser_rule!(
  HTMLAriaLevelMustBeValidRule,
  "html-aria-level-must-be-valid",
  Error,
  AriaLevelMustBeValidVisitor
);

impl AriaLevelMustBeValidVisitor {
  fn validate_aria_level(&mut self, attribute_value: &str, location: &herb::location::Location) {
    if attribute_value.is_empty() {
      self.add_offense(
        "The `aria-level` attribute must be an integer between 1 and 6, got an empty value.".to_string(),
        location.clone(),
      );

      return;
    }

    match attribute_value.parse::<i32>() {
      Ok(number) if (1..=6).contains(&number) && attribute_value == number.to_string() => {}
      _ => {
        self.add_offense(
          format!("The `aria-level` attribute must be an integer between 1 and 6, got `{}`.", attribute_value),
          location.clone(),
        );
      }
    }
  }
}

impl Visitor for AriaLevelMustBeValidVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(aria_level_attribute) = get_attribute(node, "aria-level") {
      if let Some(value) = get_static_attribute_value(aria_level_attribute) {
        self.validate_aria_level(&value, &aria_level_attribute.location);
      } else {
        if let Some(validatable) = get_validatable_static_content(aria_level_attribute) {
          self.validate_aria_level(&validatable, &aria_level_attribute.location);
        } else if has_erb_output(aria_level_attribute) {
          if let Some((static_part, erb_text)) = get_mixed_content_parts(aria_level_attribute) {
            self.add_offense(
              format!(
                "The `aria-level` attribute must be an integer between 1 and 6, got `{}` and the ERB expression `{}`.",
                static_part, erb_text
              ),
              aria_level_attribute.location.clone(),
            );
          }
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
