use crate::utils::tag_utils::{get_attribute, get_static_attribute_value};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

fn looks_like_id(text: &str) -> bool {
  if text.contains(' ') {
    return false;
  }

  if text.contains('_') || text.contains('-') {
    return true;
  }

  let chars: Vec<char> = text.chars().collect();

  if chars.is_empty() {
    return false;
  }

  if !chars[0].is_ascii_lowercase() {
    return false;
  }

  let has_uppercase = chars.iter().skip(1).any(|character| character.is_ascii_uppercase());

  if !has_uppercase {
    return false;
  }

  let mut expecting_upper_start = false;

  for character in chars.iter().skip(1) {
    if expecting_upper_start {
      if !character.is_ascii_uppercase() {
        return false;
      }
      expecting_upper_start = false;
    } else if character.is_ascii_uppercase() {
      // Start of new camelCase segment
    } else if !character.is_ascii_lowercase() {
      return false;
    }
  }

  true
}

rule_visitor!(AriaLabelIsWellFormattedVisitor);
define_parser_rule!(
  HTMLAriaLabelIsWellFormattedRule,
  "html-aria-label-is-well-formatted",
  Error,
  AriaLabelIsWellFormattedVisitor
);

impl Visitor for AriaLabelIsWellFormattedVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(aria_label_attribute) = get_attribute(node, "aria-label") {
      if let Some(value) = get_static_attribute_value(aria_label_attribute) {
        if value.contains('\n')
          || value.contains('\r')
          || value.contains("&#10;")
          || value.contains("&#13;")
          || value.to_lowercase().contains("&#x0a;")
          || value.to_lowercase().contains("&#x0d;")
        {
          self.add_offense(
            "The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.".to_string(),
            aria_label_attribute.location.clone(),
          );

          return;
        }

        if looks_like_id(&value) {
          self.add_offense(
            "The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.".to_string(),
            aria_label_attribute.location.clone(),
          );

          return;
        }

        if value.starts_with(|character: char| character.is_ascii_lowercase()) {
          self.add_offense(
            "The `aria-label` attribute value text should be formatted like visual text. Use sentence case (capitalize the first letter).".to_string(),
            aria_label_attribute.location.clone(),
          );
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
