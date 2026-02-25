use std::collections::HashSet;
use std::sync::LazyLock;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::html_data::HEAD_ONLY_TAG_NAMES;
use crate::utils::tag_utils::get_tag_name_from_element;

use herb::nodes::HTMLElementNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLBodyOnlyElementsRule;

static DOCUMENT_ONLY_TAG_NAMES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| ["html"].into_iter().collect());
static HTML_ONLY_TAG_NAMES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| ["head", "body"].into_iter().collect());
static HEAD_AND_BODY_TAG_NAMES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| ["script", "noscript", "template"].into_iter().collect());

fn is_body_only_tag(tag_name: &str) -> bool {
  let tag = tag_name.to_lowercase();

  !DOCUMENT_ONLY_TAG_NAMES.contains(tag.as_str())
    && !HTML_ONLY_TAG_NAMES.contains(tag.as_str())
    && !HEAD_ONLY_TAG_NAMES.contains(tag.as_str())
    && !HEAD_AND_BODY_TAG_NAMES.contains(tag.as_str())
}

struct BodyOnlyElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

impl Visitor for BodyOnlyElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(tag_name) = get_tag_name_from_element(node) {
      let lowercase = tag_name.to_lowercase();

      if !self.element_stack.inside("body") && self.element_stack.inside("head") && is_body_only_tag(&lowercase) {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!("Element `<{}>` must be placed inside the `<body>` tag.", lowercase),
          node.location.clone(),
        ));
      }

      self.element_stack.push(lowercase);
      self.walk_html_element_node(node);
      self.element_stack.pop();
    }
  }
}

impl Rule for HTMLBodyOnlyElementsRule {
  fn name(&self) -> &'static str {
    "html-body-only-elements"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn default_exclude(&self) -> &[&str] {
    &["**/*.xml", "**/*.xml.erb"]
  }
}

impl ParserRule for HTMLBodyOnlyElementsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = BodyOnlyElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
