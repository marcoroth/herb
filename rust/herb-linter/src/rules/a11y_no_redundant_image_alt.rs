use crate::utils::tag_utils::{get_attribute_value, get_element_attribute, get_tag_local_name, has_attribute_value, has_dynamic_attribute_value};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

const REDUNDANT_ALT_WORDS: &[&str] = &["image", "picture"];

rule_visitor!(NoRedundantImageAltVisitor);
define_parser_rule!(
  A11yNoRedundantImageAltRule,
  "a11y-no-redundant-image-alt",
  Warning,
  NoRedundantImageAltVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.10.2"
);

impl Visitor for NoRedundantImageAltVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("img") {
      if let Some(alt_attribute) = get_element_attribute(node, "alt") {
        if has_attribute_value(alt_attribute) && !has_dynamic_attribute_value(alt_attribute) {
          if let Some(alt_value) = get_attribute_value(alt_attribute) {
            let is_redundant = alt_value.to_lowercase().split_whitespace().any(|word| REDUNDANT_ALT_WORDS.contains(&word));

            if !alt_value.is_empty() && is_redundant {
              self.add_offense(
                "`<img>` `alt` prop should not contain \"image\" or \"picture\" as screen readers already announce the element as an image.",
                alt_attribute.location.clone(),
              );
            }
          }
        }
      }
    }

    self.walk_html_element_node(node);
  }
}
