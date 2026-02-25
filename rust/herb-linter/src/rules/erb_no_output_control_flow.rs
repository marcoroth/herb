use herb::nodes::ERBNode;
use herb::Visitor;

const CONTROL_FLOW_KEYWORDS: &[&str] = &["if", "unless", "else", "elsif", "end"];

rule_visitor!(NoOutputControlFlowVisitor);
define_parser_rule!(ERBNoOutputControlFlowRule, "erb-no-output-control-flow", Error, NoOutputControlFlowVisitor);

impl Visitor for NoOutputControlFlowVisitor {
  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    let open_tag = match node.tag_opening() {
      Some(token) => token,
      None => return,
    };

    if open_tag.value != "<%=" {
      return;
    }

    let content = match node.content() {
      Some(token) => &token.value,
      None => return,
    };

    let keyword = content.trim().split_whitespace().next().unwrap_or("");

    if !CONTROL_FLOW_KEYWORDS.contains(&keyword) {
      return;
    }

    self.add_offense(
      format!(
        "Control flow statements like `{}` should not be used with output tags. Use `<% {} ... %>` instead.",
        keyword, keyword
      ),
      open_tag.location.clone(),
    );
  }
}
