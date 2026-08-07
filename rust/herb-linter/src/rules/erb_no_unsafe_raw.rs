use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::html_data::NON_ESCAPING_ELEMENTS;
use crate::utils::prism_utils::walk_prism;
use crate::utils::source_slice::location_from_offset;
use crate::utils::tag_utils::get_tag_local_name;

use herb::nodes::{ERBContentNode, HTMLElementNode};
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoUnsafeRawRule;

struct ERBNoUnsafeRawVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
  source: &'rule str,
}

impl<'rule> Visitor for ERBNoUnsafeRawVisitor<'rule> {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.element_stack.push_optional(get_tag_local_name(node));
    self.walk_html_element_node(node);
    self.element_stack.pop();
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if self.element_stack.inside_any(NON_ESCAPING_ELEMENTS) {
      return;
    }

    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if !is_output_tag_opening(tag_opening) {
      return;
    }

    let prism_node = match node.prism() {
      Some(prism_node) => prism_node,
      None => return,
    };

    if self.source.is_empty() {
      return;
    }

    let mut raw_calls: Vec<(usize, usize)> = Vec::new();
    let mut html_safe_calls: Vec<(usize, usize)> = Vec::new();

    walk_prism(prism_node, &mut |candidate| {
      if candidate.is("CallNode") {
        match candidate.name.as_deref() {
          Some("raw") if candidate.receiver().is_none() => raw_calls.push((candidate.start_offset, candidate.end_offset)),

          Some("html_safe") => {
            let start_offset = candidate.receiver().map(|receiver| receiver.end_offset).unwrap_or(candidate.start_offset);

            html_safe_calls.push((start_offset, candidate.end_offset));
          }

          _ => {}
        }
      }

      true
    });

    for (start_offset, end_offset) in raw_calls {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        location_from_offset(self.source, start_offset, end_offset),
      ));
    }

    for (start_offset, end_offset) in html_safe_calls {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        "Avoid `.html_safe` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        location_from_offset(self.source, start_offset, end_offset),
      ));
    }
  }
}

impl Rule for ERBNoUnsafeRawRule {
  fn name(&self) -> &'static str {
    "erb-no-unsafe-raw"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.0")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBNoUnsafeRawRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = ERBNoUnsafeRawVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
