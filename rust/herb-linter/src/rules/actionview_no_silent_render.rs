use crate::utils::erb_utils::is_output_tag_opening;

use herb::nodes::ERBRenderNode;
use herb::Visitor;

rule_visitor!(ActionViewNoSilentRenderVisitor);
define_parser_rule!(
  ActionViewNoSilentRenderRule,
  "actionview-no-silent-render",
  Error,
  ActionViewNoSilentRenderVisitor,
  parser_options: { render_nodes: true }
);

impl Visitor for ActionViewNoSilentRenderVisitor {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if !is_output_tag_opening(tag_opening) {
      self.add_offense(
        format!(
          "Avoid using `{} %>` with `render`. Use `<%= %>` to ensure the rendered content is output.",
          tag_opening
        ),
        node.location.clone(),
      );
    }

    self.walk_erb_render_node(node);
  }
}
