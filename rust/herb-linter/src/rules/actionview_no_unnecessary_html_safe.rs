use crate::autofix::{literal_node, location_matches};
use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::source_slice::location_from_offset;
use crate::utils::tag_utils::is_erb_output_node;

use herb::nodes::{AnyNode, DocumentNode, ERBContentNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewNoUnnecessaryHTMLSafeRule;

impl Rule for ActionViewNoUnnecessaryHTMLSafeRule {
  fn name(&self) -> &'static str {
    "actionview-no-unnecessary-html-safe"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

/// A `html_safe` call on a plain String literal, with no arguments and no block.
///
/// `CallNode` serializes its node-typed fields as `receiver`, `arguments` and
/// `block`, so a lone receiver child means the call takes no arguments.
fn string_literal_receiver(prism_node: &PrismNode) -> Option<&PrismNode> {
  if !prism_node.is("CallNode") || prism_node.name.as_deref() != Some("html_safe") {
    return None;
  }

  if prism_node.has_block || prism_node.children.len() != 1 {
    return None;
  }

  let receiver = prism_node.receiver()?;

  if !receiver.is("StringNode") {
    return None;
  }

  Some(receiver)
}

struct UnnecessaryHTMLSafeVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: String,
}

impl Visitor for UnnecessaryHTMLSafeVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if is_erb_output_node(node) && !self.source.is_empty() {
      if let Some(prism_node) = node.prism() {
        if let Some(receiver) = string_literal_receiver(prism_node) {
          let literal = self.source.get(receiver.start_offset..receiver.end_offset).unwrap_or("");

          self.offenses.push(UnboundOffense::with_tags(
            self.rule_name,
            format!("Avoid calling `.html_safe` on the String literal `{literal}`. Write the content directly in the template instead."),
            location_from_offset(&self.source, prism_node.start_offset, prism_node.end_offset),
            vec!["unnecessary".to_string()],
          ));
        }
      }
    }

    self.walk_erb_content_node(node);
  }
}

impl ParserRule for ActionViewNoUnnecessaryHTMLSafeRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let mut visitor = UnnecessaryHTMLSafeVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }

  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, context: &LintContext) -> bool {
    let source = context.source.clone();
    let mut fixed = false;

    crate::autofix::for_each_node_array_mut(document, &mut |nodes| {
      if fixed {
        return;
      }

      for index in 0..nodes.len() {
        let content = match &nodes[index] {
          AnyNode::ERBContentNode(node) if is_erb_output_node(node) => {
            let prism_node = match node.prism() {
              Some(prism_node) => prism_node,
              None => continue,
            };

            if !location_matches(&location_from_offset(&source, prism_node.start_offset, prism_node.end_offset), offense) {
              continue;
            }

            match string_literal_receiver(prism_node).and_then(|receiver| receiver.unescaped.clone()) {
              Some(content) if !content.contains("<%") => content,
              _ => continue,
            }
          }
          _ => continue,
        };

        nodes[index] = AnyNode::LiteralNode(Box::new(literal_node(&content)));
        fixed = true;

        return;
      }
    });

    fixed
  }
}
