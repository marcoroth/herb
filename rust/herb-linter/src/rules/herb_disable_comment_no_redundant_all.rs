use crate::herb_disable::parse_herb_disable_content;

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(NoRedundantAllVisitor);
define_parser_rule!(
  HerbDisableCommentNoRedundantAllRule,
  "herb-disable-comment-no-redundant-all",
  Warning,
  NoRedundantAllVisitor
);

impl Visitor for NoRedundantAllVisitor {
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

    if !herb_disable.rule_names.contains(&"all".to_string()) {
      return;
    }

    if herb_disable.rule_names.len() <= 1 {
      return;
    }

    let all_detail = match herb_disable.rule_name_details.iter().find(|d| d.name == "all") {
      Some(d) => d,
      None => return,
    };

    let content_location = match &node.content {
      Some(token) => &token.location,
      None => return,
    };

    let location = all_detail.location(content_location).unwrap_or_else(|| node.location.clone());

    self.add_offense(
      "Using `all` with specific rules is redundant. Use `herb:disable all` by itself or list only specific rules.",
      location,
    );
  }
}
