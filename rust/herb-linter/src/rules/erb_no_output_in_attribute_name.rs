use crate::utils::erb_utils::{as_erb_node, is_output_tag_opening};

use herb::nodes::HTMLAttributeNameNode;
use herb::Visitor;

rule_visitor!(ERBNoOutputInAttributeNameVisitor);
define_parser_rule!(
  ERBNoOutputInAttributeNameRule,
  "erb-no-output-in-attribute-name",
  Error,
  ERBNoOutputInAttributeNameVisitor,
  introduced_in: "0.9.0"
);

impl Visitor for ERBNoOutputInAttributeNameVisitor {
  fn visit_html_attribute_name_node(&mut self, node: &HTMLAttributeNameNode) {
    for child in &node.children {
      if let Some((tag_opening, _, location)) = as_erb_node(child) {
        if is_output_tag_opening(tag_opening) {
          self.add_offense(
            "Avoid ERB output in attribute names. Use static attribute names with dynamic values instead.",
            location.clone(),
          );
        }
      }
    }

    self.walk_html_attribute_name_node(node);
  }
}
