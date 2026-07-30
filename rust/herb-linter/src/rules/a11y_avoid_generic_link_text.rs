use crate::utils::tag_utils::{get_static_body_text, get_tag_local_name, has_element_attribute};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

const BANNED_GENERIC_TEXT: &[&str] = &["read more", "learn more", "click here", "more", "link", "here"];

rule_visitor!(AvoidGenericLinkTextVisitor);
define_parser_rule!(
  A11yAvoidGenericLinkTextRule,
  "a11y-avoid-generic-link-text",
  Warning,
  AvoidGenericLinkTextVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.10.2"
);

fn strip_text(text: &str) -> String {
  let mut result = String::new();
  let mut in_separator = false;

  for character in text.to_lowercase().chars() {
    if character.is_alphanumeric() || character == '_' {
      result.push(character);
      in_separator = false;
    } else if !in_separator {
      result.push(' ');
      in_separator = true;
    }
  }

  result.trim().to_string()
}

impl Visitor for AvoidGenericLinkTextVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("a") && !has_element_attribute(node, "aria-labelledby") && !has_element_attribute(node, "aria-label") {
      if let Some(text_content) = get_static_body_text(&node.body) {
        if BANNED_GENERIC_TEXT.contains(&strip_text(&text_content).as_str()) {
          self.add_offense(
            format!(
              "Avoid using generic link text such as \"{}\". Screen reader users often navigate by links, and generic text like \"Read more\", \"Learn more\", \"Click here\", \"More\", \"Link\", or \"Here\" is not meaningful out of context.",
              text_content.trim()
            ),
            node.location.clone(),
          );
        }
      }
    }

    self.walk_html_element_node(node);
  }
}
