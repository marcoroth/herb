use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::prism_utils::{is_assignment_node, is_control_flow_node, is_side_effect_call, unwrap_modifier_statement};

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(ERBNoSilentStatementVisitor);
define_parser_rule!(
  ERBNoSilentStatementRule,
  "erb-no-silent-statement",
  Warning,
  ERBNoSilentStatementVisitor,
  enabled: false,
  parser_options: { prism_nodes: true }
);

impl Visitor for ERBNoSilentStatementVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if is_output_tag_opening(tag_opening) {
      return;
    }

    let prism_node = match node.prism_node_ast {
      Some(ref prism_node) => prism_node,
      None => return,
    };

    if is_assignment_node(prism_node) {
      return;
    }

    let statement = unwrap_modifier_statement(prism_node);

    if is_control_flow_node(statement) || is_side_effect_call(statement) {
      return;
    }

    let content = node.content.as_ref().map(|token| token.value.trim()).unwrap_or("");

    if content.is_empty() {
      return;
    }

    self.add_offense(
      format!(
        "Avoid using silent ERB tags for statements. Move `{}` to a controller, helper, or presenter.",
        content
      ),
      node.location.clone(),
    );
  }
}
