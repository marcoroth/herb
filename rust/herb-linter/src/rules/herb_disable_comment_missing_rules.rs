use crate::herb_disable::parse_herb_disable_content;

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(MissingRulesVisitor);
define_parser_rule!(
  HerbDisableCommentMissingRulesRule,
  "herb-disable-comment-missing-rules",
  Error,
  MissingRulesVisitor
);

impl Visitor for MissingRulesVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let opening_tag = match &node.tag_opening {
      Some(token) => &token.value,
      None => return,
    };

    if opening_tag != "<%#" {
      return;
    }

    let content = match &node.content {
      Some(token) => &token.value,
      None => return,
    };

    if parse_herb_disable_content(content).is_some() {
      return;
    }

    let trimmed = content.trim();

    if !trimmed.starts_with("herb:disable") {
      return;
    }

    let after_prefix = trimmed["herb:disable".len()..].trim();

    if !after_prefix.is_empty() {
      return;
    }

    self.add_offense(
      "`herb:disable` comment is missing rule names. Specify `all` or list specific rules to disable.",
      node.location.clone(),
    );
  }
}
