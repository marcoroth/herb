use crate::utils::attribute_visitor::{classify_attribute, AttributeKind};
use crate::utils::erb_utils::as_erb_node;
use crate::utils::tag_utils::get_attributes;

use herb::nodes::{AnyNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(ERBNoRawOutputInAttributeValueVisitor);
define_parser_rule!(
  ERBNoRawOutputInAttributeValueRule,
  "erb-no-raw-output-in-attribute-value",
  Error,
  ERBNoRawOutputInAttributeValueVisitor,
  introduced_in: "0.9.0"
);

impl ERBNoRawOutputInAttributeValueVisitor {
  fn check_value_nodes(&mut self, nodes: &[AnyNode]) {
    for node in nodes {
      if let Some((tag_opening, _, location)) = as_erb_node(node) {
        if tag_opening == "<%==" {
          self.add_offense(
            "Avoid `<%==` in attribute values. Use `<%= %>` instead to ensure proper HTML escaping.",
            location.clone(),
          );
        }
      }
    }
  }
}

impl Visitor for ERBNoRawOutputInAttributeValueVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      match classify_attribute(attribute) {
        Some(AttributeKind::StaticNameDynamicValue { value_nodes, .. }) | Some(AttributeKind::DynamicNameDynamicValue { value_nodes, .. }) => {
          self.check_value_nodes(value_nodes)
        }

        _ => {}
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
