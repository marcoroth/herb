use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag, has_aria_hidden_true, has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoAriaHiddenOnFocusableVisitor);
define_parser_rule!(
  HTMLNoAriaHiddenOnFocusableRule,
  "html-no-aria-hidden-on-focusable",
  Error,
  NoAriaHiddenOnFocusableVisitor
);

static INTERACTIVE_ELEMENTS: LazyLock<HashSet<&'static str>> =
  LazyLock::new(|| ["button", "summary", "input", "select", "textarea", "a"].into_iter().collect());

fn get_tab_index_value(node: &HTMLOpenTagNode) -> Option<i32> {
  get_attribute(node, "tabindex")
    .and_then(|attribute| get_static_attribute_value(attribute))
    .and_then(|value| value.parse::<i32>().ok())
}

fn is_focusable(node: &HTMLOpenTagNode) -> bool {
  let tag_name = match get_tag_name_from_open_tag(node) {
    Some(name) => name,
    None => return false,
  };

  let tag_lower = tag_name.to_lowercase();
  let tab_index = get_tab_index_value(node);

  if tag_lower == "a" {
    let has_href = has_attribute(node, "href");

    if !has_href {
      return tab_index.map(|v| v >= 0).unwrap_or(false);
    }

    return tab_index.map(|v| v >= 0).unwrap_or(true);
  }

  if INTERACTIVE_ELEMENTS.contains(tag_lower.as_str()) {
    tab_index.map(|v| v >= 0).unwrap_or(true)
  } else {
    tab_index.map(|v| v >= 0).unwrap_or(false)
  }
}

impl Visitor for NoAriaHiddenOnFocusableVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if has_aria_hidden_true(node) && is_focusable(node) {
      self.add_offense(
        "Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.".to_string(),
        tag_name_location(node),
      );
    }

    self.walk_html_open_tag_node(node);
  }
}
