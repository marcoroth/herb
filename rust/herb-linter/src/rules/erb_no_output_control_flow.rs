use herb::nodes::{ERBElseNode, ERBEndNode, ERBIfNode, ERBUnlessNode};
use herb::{Token, Visitor};

rule_visitor!(NoOutputControlFlowVisitor);
define_parser_rule!(ERBNoOutputControlFlowRule, "erb-no-output-control-flow", Error, NoOutputControlFlowVisitor);

impl NoOutputControlFlowVisitor {
  fn check_output_control_flow(&mut self, tag_opening: Option<&Token>, content: Option<&Token>, fallback: &str) {
    let open_tag = match tag_opening {
      Some(token) if token.value == "<%=" => token,
      _ => return,
    };

    let keyword = content
      .map(|token| token.value.trim().split_whitespace().next().unwrap_or("").to_string())
      .filter(|keyword| !keyword.is_empty())
      .unwrap_or_else(|| fallback.to_string());

    self.add_offense(
      format!(
        "Control flow statements like `{}` should not be used with output tags. Use `<% {} ... %>` instead.",
        keyword, keyword
      ),
      open_tag.location.clone(),
    );
  }
}

impl Visitor for NoOutputControlFlowVisitor {
  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), "if");
    self.walk_erb_if_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), "unless");
    self.walk_erb_unless_node(node);
  }

  fn visit_erb_else_node(&mut self, node: &ERBElseNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), "else");
    self.walk_erb_else_node(node);
  }

  fn visit_erb_end_node(&mut self, node: &ERBEndNode) {
    self.check_output_control_flow(node.tag_opening.as_ref(), node.content.as_ref(), "end");
    self.walk_erb_end_node(node);
  }
}
