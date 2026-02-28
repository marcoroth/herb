use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(NoEmptyTagsVisitor);
define_parser_rule!(ERBNoEmptyTagsRule, "erb-no-empty-tags", Error, NoEmptyTagsVisitor);

impl Visitor for NoEmptyTagsVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let content = match &node.content {
      Some(token) => &token.value,
      None => return,
    };

    if let Some(ref tag_closing) = node.tag_closing {
      if tag_closing.value.is_empty() {
        return;
      }
    }

    if content.trim().is_empty() {
      self.add_offense(
        "ERB tag should not be empty. Remove empty ERB tags or add content.".to_string(),
        node.location.clone(),
      );
    }

    self.walk_erb_content_node(node);
  }
}
