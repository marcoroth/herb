use crate::utils::tag_utils::{get_attribute, get_static_attribute_value};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

/// Mirrors the JavaScript `/^[a-z]+([A-Z][a-z]*)*$/` test.
fn is_camel_case(text: &str) -> bool {
  let mut characters = text.chars().peekable();
  let mut leading = 0;

  while characters.peek().map(char::is_ascii_lowercase).unwrap_or(false) {
    characters.next();
    leading += 1;
  }

  if leading == 0 {
    return false;
  }

  while let Some(character) = characters.next() {
    if !character.is_ascii_uppercase() {
      return false;
    }

    while characters.peek().map(char::is_ascii_lowercase).unwrap_or(false) {
      characters.next();
    }
  }

  true
}

fn looks_like_id(text: &str) -> bool {
  (text.contains('_') || text.contains('-') || is_camel_case(text)) && !text.contains(' ')
}

rule_visitor!(AriaLabelIsWellFormattedVisitor);
define_parser_rule!(
  HTMLAriaLabelIsWellFormattedRule,
  "html-aria-label-is-well-formatted",
  Warning,
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
