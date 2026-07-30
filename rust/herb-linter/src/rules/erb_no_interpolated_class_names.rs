use crate::utils::attribute_visitor::{classify_attribute, AttributeKind};
use crate::utils::class_grouping::{group_nodes_by_class, split_literals_at_whitespace};
use crate::utils::tag_utils::get_attributes;

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(ERBNoInterpolatedClassNamesVisitor);
define_parser_rule!(
  ERBNoInterpolatedClassNamesRule,
  "erb-no-interpolated-class-names",
  Warning,
  ERBNoInterpolatedClassNamesVisitor
);

impl Visitor for ERBNoInterpolatedClassNamesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      let value_nodes = match classify_attribute(attribute) {
        Some(AttributeKind::StaticNameDynamicValue {
          attribute_name, value_nodes, ..
        }) if attribute_name == "class" => value_nodes,

        _ => continue,
      };

      let value_location = match attribute.value.as_ref() {
        Some(value_node) => value_node.location.clone(),
        None => continue,
      };

      for group in group_nodes_by_class(split_literals_at_whitespace(value_nodes)) {
        if group.iter().all(|node| node.is_pure_whitespace()) {
          continue;
        }

        if !group.iter().any(|node| !node.is_literal()) {
          continue;
        }

        if !group.iter().any(|node| node.is_literal() && !node.content().trim().is_empty()) {
          continue;
        }

        let class_name: String = group.iter().map(|node| node.printed()).collect();

        self.add_offense(
          format!(
            "Avoid ERB interpolation inside class names: `{}`. Use standalone ERB expressions that output complete class names instead.",
            class_name
          ),
          value_location.clone(),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
