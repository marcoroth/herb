use crate::utils::source_slice::collapse_newline_runs;
use herb::nodes::{ERBElseNode, ERBEndNode, ERBIfNode, ERBUnlessNode};
use herb::{Token, Visitor};

rule_visitor!(NoOutputControlFlowVisitor);
define_parser_rule!(ERBNoOutputControlFlowRule, "erb-no-output-control-flow", Error, NoOutputControlFlowVisitor,
  parser_options: { iteration_nodes: true },
  introduced_in: "0.4.0"
);

impl NoOutputControlFlowVisitor {
  fn check_output_control_flow(&mut self, tag_opening: Option<&Token>, content: Option<&Token>, tag_closing: Option<&Token>, fallback: &str) {
    let open_tag = match tag_opening {
      Some(token) if token.value == "<%=" => token,
      _ => return,
    };

    let collapsed = content.map(|token| collapse_newline_runs(&token.value)).unwrap_or_default();

    let keyword = collapsed
      .trim()
      .split_whitespace()
      .next()
      .filter(|keyword| !keyword.is_empty())
      .map(|keyword| keyword.to_string())
      .unwrap_or_else(|| fallback.to_string());

    let closing = tag_closing.map(|token| token.value.as_str()).unwrap_or("%>");

    let suggestion = if collapsed.is_empty() {
      format!("<% {keyword} ... {closing}")
    } else {
      format!("<%{collapsed}{closing}")
    };

    self.add_offense(
      format!("Control flow statements like `{keyword}` should not be used with output tags. Use `{suggestion}` instead."),
      open_tag.location.clone(),
    );
  }

  fn check_output_iteration_block(&mut self, node: &herb::nodes::ERBIterationBlockNode) {
    let open_tag = match node.tag_opening.as_ref() {
      Some(token) if token.value == "<%=" => token,
      _ => return,
    };

    let method = node.message.as_ref().map(|token| token.value.as_str()).unwrap_or("each");
    let content = node.content.as_ref().map(|token| token.value.as_str()).unwrap_or(" ");
    let closing = node.tag_closing.as_ref().map(|token| token.value.as_str()).unwrap_or("%>");
    let suggestion = collapse_newline_runs(&format!("<%{content}{closing}"));

    self.add_offense(
      format!(
        "Iteration blocks like `{method}` should not be used with output tags, they return the collection instead of the rendered output. Use `{suggestion}` instead."
      ),
      open_tag.location.clone(),
    );
  }
}

impl Visitor for NoOutputControlFlowVisitor {
  fn visit_erb_iteration_block_node(&mut self, node: &herb::nodes::ERBIterationBlockNode) {
    self.check_output_iteration_block(node);
    self.walk_erb_iteration_block_node(node);
  }

  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), node.tag_closing.as_ref(), "if");
    self.walk_erb_if_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), node.tag_closing.as_ref(), "unless");
    self.walk_erb_unless_node(node);
  }

  fn visit_erb_else_node(&mut self, node: &ERBElseNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), node.tag_closing.as_ref(), "else");
    self.walk_erb_else_node(node);
  }

  fn visit_erb_end_node(&mut self, node: &ERBEndNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), node.tag_closing.as_ref(), "end");
    self.walk_erb_end_node(node);
  }
}
