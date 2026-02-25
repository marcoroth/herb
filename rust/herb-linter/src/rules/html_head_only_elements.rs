use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::html_data::HEAD_ONLY_TAG_NAMES;
use crate::utils::tag_utils::{get_open_tag, get_tag_name_from_element, has_attribute};

use herb::nodes::HTMLElementNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLHeadOnlyElementsRule;

struct HeadOnlyElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

impl Visitor for HeadOnlyElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(tag_name) = get_tag_name_from_element(node) {
      let lowercase = tag_name.to_lowercase();

      if !self.element_stack.inside("head") && self.element_stack.inside("body") && HEAD_ONLY_TAG_NAMES.contains(lowercase.as_str()) {
        if (lowercase == "title" || lowercase == "style") && self.element_stack.inside("svg") {
          // allowed
        } else if lowercase == "meta" {
          if let Some(open_tag) = get_open_tag(node) {
            if !has_attribute(open_tag, "itemprop") {
              self.offenses.push(UnboundOffense::new(
                self.rule_name,
                format!("Element `<{}>` must be placed inside the `<head>` tag.", lowercase),
                node.location.clone(),
              ));
            }
          } else {
            self.offenses.push(UnboundOffense::new(
              self.rule_name,
              format!("Element `<{}>` must be placed inside the `<head>` tag.", lowercase),
              node.location.clone(),
            ));
          }
        } else {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!("Element `<{}>` must be placed inside the `<head>` tag.", lowercase),
            node.location.clone(),
          ));
        }
      }

      self.element_stack.push(lowercase);
      self.walk_html_element_node(node);
      self.element_stack.pop();
    }
  }
}

impl Rule for HTMLHeadOnlyElementsRule {
  fn name(&self) -> &'static str {
    "html-head-only-elements"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn default_exclude(&self) -> &[&str] {
    &["**/*.xml", "**/*.xml.erb"]
  }
}

impl ParserRule for HTMLHeadOnlyElementsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = HeadOnlyElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
