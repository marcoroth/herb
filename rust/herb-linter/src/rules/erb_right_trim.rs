use herb::nodes::ERBNode;
use herb::Visitor;

rule_visitor!(RightTrimVisitor);
define_parser_rule!(ERBRightTrimRule, "erb-right-trim", Error, RightTrimVisitor);

impl Visitor for RightTrimVisitor {
  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    let token = match node.tag_closing() {
      Some(token) => token,
      None => return,
    };

    if token.value != "=%>" {
      return;
    }

    self.add_offense(
      "Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.".to_string(),
      token.location.clone(),
    );
  }
}
