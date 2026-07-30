use crate::utils::tag_utils::{element_tag_name_location, get_element_attribute, get_static_attribute_value, get_tag_local_name};

use herb::nodes::{AnyNode, HTMLAttributeNode, HTMLElementNode};
use herb::Visitor;

rule_visitor!(AnchorRequireHrefVisitor);
define_parser_rule!(
  HTMLAnchorRequireHrefRule,
  "html-anchor-require-href",
  Error,
  AnchorRequireHrefVisitor,
  parser_options: { action_view_helpers: true }
);

impl AnchorRequireHrefVisitor {
  fn has_nil_href_value(attribute: &HTMLAttributeNode) -> bool {
    let value_node = match attribute.value.as_ref() {
      Some(value_node) => value_node,
      None => return false,
    };

    value_node.children.iter().any(|child| match child {
      AnyNode::RubyLiteralNode(literal) => literal.content == "url_for(nil)",
      _ => false,
    })
  }

  fn check_a_tag(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() != Some("a") {
      return;
    }

    let href_attribute = match get_element_attribute(node, "href") {
      Some(attribute) => attribute,

      None => {
        self.add_offense(
          "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.",
          element_tag_name_location(node),
        );

        return;
      }
    };

    let href_value = get_static_attribute_value(href_attribute);

    if href_value.as_deref() == Some("#") {
      self.add_offense(
        "Avoid `href=\"#\"` on `<a>`. `href=\"#\"` does not navigate anywhere, scrolls the page to the top, and adds `#` to the URL. If you need a clickable element without navigation, use a `<button>` instead.",
        href_attribute.location.clone(),
      );

      return;
    }

    if href_value.as_deref().map(|value| value.starts_with("javascript:void")).unwrap_or(false) {
      self.add_offense(
        "Avoid `javascript:void(0)` in `href` on `<a>`. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.",
        href_attribute.location.clone(),
      );

      return;
    }

    if Self::has_nil_href_value(href_attribute) {
      self.add_offense(
        "Avoid passing `nil` as the URL for `link_to`. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.",
        href_attribute.location.clone(),
      );
    }
  }
}

impl Visitor for AnchorRequireHrefVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.check_a_tag(node);
    self.walk_html_element_node(node);
  }
}
