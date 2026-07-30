use crate::utils::tag_utils::get_attribute;

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(TurboPermanentRequireIdVisitor);
define_parser_rule!(TurboPermanentRequireIdRule, "turbo-permanent-require-id", Error, TurboPermanentRequireIdVisitor,
  introduced_in: "0.9.0"
);

impl Visitor for TurboPermanentRequireIdVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(turbo_permanent_attribute) = get_attribute(node, "data-turbo-permanent") {
      if get_attribute(node, "id").is_none() {
        self.add_offense(
          "Elements with `data-turbo-permanent` must have an `id` attribute. Without an `id`, Turbo can't track the element across page changes and the permanent behavior won't work as expected.",
          turbo_permanent_attribute.location.clone(),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
