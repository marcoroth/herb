use std::collections::{HashMap, HashSet};

use crate::herb_disable::parse_herb_disable_content;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::ERBContentNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HerbDisableCommentUnnecessaryRule;

struct UnnecessaryVisitor<'rule> {
  rule_name: &'static str,
  ignored_offenses_by_line: &'rule HashMap<u32, HashSet<String>>,
  valid_rule_names: HashSet<String>,
  offenses: Vec<UnboundOffense>,
}

impl<'rule> Visitor for UnnecessaryVisitor<'rule> {
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

    let line = node.location.start.line;
    let empty_set = HashSet::new();
    let used_rule_names = self.ignored_offenses_by_line.get(&line).unwrap_or(&empty_set);

    if herb_disable.rule_names.contains(&"all".to_string()) {
      if herb_disable.rule_names.len() > 1 {
        return;
      }

      if !used_rule_names.is_empty() {
        return;
      }

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "No offenses to disable on this line. Remove the `herb:disable all` comment.",
        node.location.clone(),
      ));

      return;
    }

    let unnecessary_rules: Vec<_> = herb_disable
      .rule_name_details
      .iter()
      .filter(|detail| self.valid_rule_names.contains(&detail.name) && !used_rule_names.contains(&detail.name))
      .collect();

    if unnecessary_rules.is_empty() {
      return;
    }

    let valid_rule_count = herb_disable.rule_names.iter().filter(|name| self.valid_rule_names.contains(*name)).count();

    if unnecessary_rules.len() == valid_rule_count {
      if unnecessary_rules.len() == 1 {
        let rule_name = &unnecessary_rules[0].name;
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!("No offenses from `{}` on this line. Remove the `herb:disable` comment.", rule_name),
          node.location.clone(),
        ));

        return;
      }

      let unnecessary_names: Vec<String> = unnecessary_rules.iter().map(|r| format!("`{}`", r.name)).collect();

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "No offenses from rules {} on this line. Remove them from the `herb:disable` comment.",
          unnecessary_names.join(", ")
        ),
        node.location.clone(),
      ));

      return;
    }

    let content_location = match &node.content {
      Some(token) => &token.location,
      None => return,
    };

    for unnecessary_rule in &unnecessary_rules {
      let location = unnecessary_rule.location(content_location).unwrap_or_else(|| node.location.clone());

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "No offenses from `{}` on this line. Remove it from the `herb:disable` comment.",
          unnecessary_rule.name
        ),
        location,
      ));
    }
  }
}

impl Rule for HerbDisableCommentUnnecessaryRule {
  fn name(&self) -> &'static str {
    "herb-disable-comment-unnecessary"
  }

  fn default_severity(&self) -> Severity {
    Severity::Warning
  }
}

impl ParserRule for HerbDisableCommentUnnecessaryRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    if context.valid_rule_names.is_empty() {
      return Vec::new();
    }

    let mut valid_set: HashSet<String> = context.valid_rule_names.iter().cloned().collect();
    valid_set.insert("all".to_string());

    let mut visitor = UnnecessaryVisitor {
      rule_name: self.name(),
      ignored_offenses_by_line: &context.ignored_offenses_by_line,
      valid_rule_names: valid_set,
      offenses: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
