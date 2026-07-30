use crate::utils::tag_utils::get_tag_local_name;

use herb::nodes::{AnyNode, HTMLElementNode};
use herb::Visitor;

rule_visitor!(DetailsHasSummaryVisitor);
define_parser_rule!(
  HTMLDetailsHasSummaryRule,
  "html-details-has-summary",
  Warning,
  DetailsHasSummaryVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.9.0"
);

impl DetailsHasSummaryVisitor {
  fn has_direct_summary_child(node: &HTMLElementNode) -> bool {
    node.body.iter().any(|child| match child {
      AnyNode::HTMLElementNode(element) => get_tag_local_name(element).as_deref() == Some("summary"),
      _ => false,
    })
  }
}

impl Visitor for DetailsHasSummaryVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("details") && !Self::has_direct_summary_child(node) {
      self.add_offense("`<details>` element must have a direct `<summary>` child element.", node.location.clone());
    }

    self.walk_html_element_node(node);
  }
}
