use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::tag_utils::{get_open_tag, get_tag_name_from_element, get_tag_name_from_open_tag, tag_name_location};

use herb::nodes::{HTMLElementNode, HTMLOpenTagNode};
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLNoNestedLinksRule;

struct NestedLinksVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  link_depth: usize,
}

impl NestedLinksVisitor {
  fn check_nested_link(&mut self, open_tag: &HTMLOpenTagNode) -> bool {
    if self.link_depth > 0 {
      let location = tag_name_location(open_tag);

      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Nested `<a>` elements are not allowed. Links cannot contain other links.",
        location,
      ));

      return true;
    }

    false
  }
}

impl Visitor for NestedLinksVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let tag_name = get_tag_name_from_element(node).map(|name| name.to_lowercase());

    if tag_name.as_deref() != Some("a") {
      self.walk_html_element_node(node);
      return;
    }

    if let Some(open_tag) = get_open_tag(node) {
      self.check_nested_link(open_tag);
    }

    self.link_depth += 1;
    self.walk_html_element_node(node);
    self.link_depth -= 1;
  }

  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    let tag_name = get_tag_name_from_open_tag(node).map(|name| name.to_lowercase());

    if tag_name.as_deref() == Some("a") && node.is_void {
      self.check_nested_link(node);
    }

    self.walk_html_open_tag_node(node);
  }
}

impl Rule for HTMLNoNestedLinksRule {
  fn name(&self) -> &'static str {
    "html-no-nested-links"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for HTMLNoNestedLinksRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NestedLinksVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      link_depth: 0,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
