use crate::utils::tag_utils::{element_has_aria_hidden, element_tag_name_location, get_tag_local_name, has_element_attribute};

use herb::nodes::{AnyNode, HTMLElementNode};
use herb::Visitor;

rule_visitor!(SvgHasAccessibleTextVisitor);
define_parser_rule!(
  A11ySVGHasAccessibleTextRule,
  "a11y-svg-has-accessible-text",
  Warning,
  SvgHasAccessibleTextVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true }
);

impl SvgHasAccessibleTextVisitor {
  fn has_direct_title_child(node: &HTMLElementNode) -> bool {
    node.body.iter().any(|child| match child {
      AnyNode::HTMLElementNode(element) => get_tag_local_name(element).as_deref() == Some("title"),
      _ => false,
    })
  }
}

impl Visitor for SvgHasAccessibleTextVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("svg")
      && !element_has_aria_hidden(node)
      && !has_element_attribute(node, "aria-label")
      && !has_element_attribute(node, "aria-labelledby")
      && !Self::has_direct_title_child(node)
    {
      self.add_offense(
        "`<svg>` must have accessible text. Set `aria-label`, or `aria-labelledby`, or nest a `<title>` element. If the `<svg>` is decorative, hide it with `aria-hidden=\"true\"`.",
        element_tag_name_location(node),
      );
    }

    self.walk_html_element_node(node);
  }
}
