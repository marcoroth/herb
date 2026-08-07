use crate::utils::tag_utils::get_attribute_in;

use herb::nodes::{AnyNode, ERBOpenTagNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(TurboPermanentRequireIdVisitor);
define_parser_rule!(TurboPermanentRequireIdRule, "turbo-permanent-require-id", Error, TurboPermanentRequireIdVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.9.0"
);

impl TurboPermanentRequireIdVisitor {
  fn check_children(&mut self, children: &[AnyNode]) {
    if let Some(turbo_permanent_attribute) = get_attribute_in(children, "data-turbo-permanent") {
      if get_attribute_in(children, "id").is_none() {
        self.add_offense(
          "Elements with `data-turbo-permanent` must have an `id` attribute. Without an `id`, Turbo can't track the element across page changes and the permanent behavior won't work as expected.",
          turbo_permanent_attribute.location.clone(),
        );
      }
    }
  }
}

impl Visitor for TurboPermanentRequireIdVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_children(&node.children);
    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_children(&node.children);
    self.walk_erb_open_tag_node(node);
  }
}
