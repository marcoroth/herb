use crate::utils::action_view_utils::{is_conditional_tag_attributes_call, is_tag_attributes_call};
use crate::utils::erb_utils::is_output_tag_opening;

use herb::nodes::{AnyNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(ERBNoOutputInAttributePositionVisitor);
define_parser_rule!(
  ERBNoOutputInAttributePositionRule,
  "erb-no-output-in-attribute-position",
  Error,
  ERBNoOutputInAttributePositionVisitor,
  parser_options: { prism_nodes: true },
  introduced_in: "0.9.0"
);

impl Visitor for ERBNoOutputInAttributePositionVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for child in &node.children {
      let erb = match child {
        AnyNode::ERBContentNode(erb) => erb,
        _ => continue,
      };

      let tag_opening = erb.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

      if !is_output_tag_opening(tag_opening) {
        continue;
      }

      if let Some(ref prism_node) = erb.prism_node_ast {
        if is_tag_attributes_call(prism_node) {
          continue;
        }

        if is_conditional_tag_attributes_call(prism_node) {
          self.add_offense(
            "Avoid using conditional `tag.attributes` in attribute position. Use `<% if ... %><%= tag.attributes(...) %><% end %>` instead.",
            erb.location.clone(),
          );

          continue;
        }
      }

      self.add_offense(
        "Avoid `<%= %>` in attribute position. Use `<% if ... %>` with static attributes instead.",
        erb.location.clone(),
      );
    }

    self.walk_html_open_tag_node(node);
  }
}
