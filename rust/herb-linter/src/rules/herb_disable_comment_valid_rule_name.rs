use std::collections::HashSet;

use crate::herb_disable::parse_herb_disable_content;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::didyoumean::didyoumean;

use herb::nodes::ERBContentNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HerbDisableCommentValidRuleNameRule;

struct ValidRuleNameVisitor {
  rule_name: &'static str,
  valid_rule_names: HashSet<String>,
  valid_rule_names_list: Vec<String>,
  offenses: Vec<UnboundOffense>,
}

impl Visitor for ValidRuleNameVisitor {
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
      Some(disable_comment) => disable_comment,
      None => return,
    };

    let content_location = match &node.content {
      Some(token) => &token.location,
      None => return,
    };

    for rule_detail in &herb_disable.rule_name_details {
      if self.valid_rule_names.contains(&rule_detail.name) {
        continue;
      }

      let suggestion = didyoumean(&rule_detail.name, &self.valid_rule_names_list);
      let message = match suggestion {
        Some(ref suggested) => format!("Unknown rule `{}`. Did you mean `{}`?", rule_detail.name, suggested),
        None => format!("Unknown rule `{}`.", rule_detail.name),
      };

      let location = rule_detail.location(content_location).unwrap_or_else(|| node.location.clone());

      self.offenses.push(UnboundOffense::new(self.rule_name, message, location));
    }
  }
}

impl Rule for HerbDisableCommentValidRuleNameRule {
  fn name(&self) -> &'static str {
    "herb-disable-comment-valid-rule-name"
  }

  fn default_severity(&self) -> Severity {
    Severity::Warning
  }
}

impl ParserRule for HerbDisableCommentValidRuleNameRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    if context.valid_rule_names.is_empty() {
      return Vec::new();
    }

    let mut valid_set: HashSet<String> = context.valid_rule_names.iter().cloned().collect();
    valid_set.insert("all".to_string());

    let mut valid_list = context.valid_rule_names.clone();
    if !valid_list.contains(&"all".to_string()) {
      valid_list.push("all".to_string());
    }

    let mut visitor = ValidRuleNameVisitor {
      rule_name: self.name(),
      valid_rule_names: valid_set,
      valid_rule_names_list: valid_list,
      offenses: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
