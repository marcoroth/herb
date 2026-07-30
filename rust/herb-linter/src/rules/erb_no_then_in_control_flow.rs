use herb::nodes::{ERBIfNode, ERBInNode, ERBUnlessNode, ERBWhenNode};
use herb::Location;
use herb::Visitor;

rule_visitor!(ERBNoThenInControlFlowVisitor);
define_parser_rule!(
  ERBNoThenInControlFlowRule,
  "erb-no-then-in-control-flow",
  Warning,
  ERBNoThenInControlFlowVisitor,
  parser_options: { strict: true }
);

impl ERBNoThenInControlFlowVisitor {
  fn check_then_keyword(&mut self, keyword: &str, then_keyword: &Option<Location>) {
    if let Some(location) = then_keyword {
      self.add_offense(
        format!(
          "Avoid using `then` in `{}` expressions inside ERB templates. Use the multiline block form instead.",
          keyword
        ),
        location.clone(),
      );
    }
  }
}

impl Visitor for ERBNoThenInControlFlowVisitor {
  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    let content = node.content.as_ref().map(|token| token.value.trim()).unwrap_or("");
    let keyword = if content.starts_with("elsif") { "elsif" } else { "if" };

    self.check_then_keyword(keyword, &node.then_keyword);
    self.walk_erb_if_node(node);
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    self.check_then_keyword("unless", &node.then_keyword);
    self.walk_erb_unless_node(node);
  }

  fn visit_erb_when_node(&mut self, node: &ERBWhenNode) {
    self.check_then_keyword("when", &node.then_keyword);
    self.walk_erb_when_node(node);
  }

  fn visit_erb_in_node(&mut self, node: &ERBInNode) {
    self.check_then_keyword("in", &node.then_keyword);
    self.walk_erb_in_node(node);
  }
}
