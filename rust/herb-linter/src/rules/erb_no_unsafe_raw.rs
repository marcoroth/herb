use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::tag_utils::get_tag_local_name;

use herb::nodes::{ERBContentNode, HTMLElementNode};
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const RAW_TEXT_ELEMENTS: &[&str] = &[
  "title",
  "textarea",
  "script",
  "style",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "listing",
  "plaintext",
];

pub struct ERBNoUnsafeRawRule;

struct ERBNoUnsafeRawVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

/// Matches `/\braw[\s(]/`.
fn has_raw_call(content: &str) -> bool {
  let bytes = content.as_bytes();
  let mut start = 0;

  while let Some(offset) = content[start..].find("raw") {
    let index = start + offset;
    let rest = &content[index + 3..];

    let boundary_before = index == 0 || !(bytes[index - 1].is_ascii_alphanumeric() || bytes[index - 1] == b'_');
    let followed_by_call = rest.starts_with(char::is_whitespace) || rest.starts_with('(');

    if boundary_before && followed_by_call {
      return true;
    }

    start = index + 1;
  }

  false
}

/// Matches `/\.html_safe\b/`.
fn has_html_safe_call(content: &str) -> bool {
  let mut start = 0;

  while let Some(offset) = content[start..].find(".html_safe") {
    let index = start + offset;
    let rest = &content[index + ".html_safe".len()..];

    if !rest.starts_with(|c: char| c.is_alphanumeric() || c == '_') {
      return true;
    }

    start = index + 1;
  }

  false
}

impl Visitor for ERBNoUnsafeRawVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.element_stack.push_optional(get_tag_local_name(node));
    self.walk_html_element_node(node);
    self.element_stack.pop();
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if self.element_stack.inside_any(RAW_TEXT_ELEMENTS) {
      return;
    }

    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if !is_output_tag_opening(tag_opening) {
      return;
    }

    let content = node.content.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if has_raw_call(content) {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        node.location.clone(),
      ));
    }

    if has_html_safe_call(content) {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Avoid `.html_safe` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        node.location.clone(),
      ));
    }
  }
}

impl Rule for ERBNoUnsafeRawRule {
  fn name(&self) -> &'static str {
    "erb-no-unsafe-raw"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }
}

impl ParserRule for ERBNoUnsafeRawRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = ERBNoUnsafeRawVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
