use std::collections::HashMap;

use crate::herb_disable::parse_herb_disable_content;

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(NoDuplicateRulesVisitor);
define_parser_rule!(
  HerbDisableCommentNoDuplicateRulesRule,
  "herb-disable-comment-no-duplicate-rules",
  Warning,
  NoDuplicateRulesVisitor
);

impl Visitor for NoDuplicateRulesVisitor {
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

    let herb_disable = match parse_herb_disable_content(content) {
      Some(hd) => hd,
      None => return,
    };

    let content_location = match &node.content {
      Some(token) => &token.location,
      None => return,
    };

    let mut seen: HashMap<String, usize> = HashMap::new();

    for (index, rule_detail) in herb_disable.rule_name_details.iter().enumerate() {
      if seen.contains_key(&rule_detail.name) {
        let location = rule_detail.location(content_location).unwrap_or_else(|| node.location.clone());

        self.add_offense(
          format!("Duplicate rule `{}` in `herb:disable` comment. Remove the duplicate.", rule_detail.name),
          location,
        );
      } else {
        seen.insert(rule_detail.name.clone(), index);
      }
    }
  }
}
