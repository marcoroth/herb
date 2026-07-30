use crate::autofix::{erb_output_node, for_each_node_array_mut, literal_node};
use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::source_slice::location_from_offset;
use crate::utils::tag_utils::get_open_tag;
use herb::nodes::{AnyNode, DocumentNode};

use herb::nodes::ERBContentNode;
use herb::{ParseResult, Visitor};
use herb_config::{Severity, SeverityConfig};

pub struct ERBPreferDirectOutputRule;

struct PreferDirectOutputVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
}

impl<'rule> Visitor for PreferDirectOutputVisitor<'rule> {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if !is_output_tag_opening(tag_opening) {
      return;
    }

    let prism_node = match node.prism_node_ast {
      Some(ref prism_node) => prism_node,
      None => return,
    };

    if self.source.is_empty() {
      return;
    }

    let content = node.content.as_ref().map(|token| token.value.trim()).unwrap_or("");
    let location = location_from_offset(self.source, prism_node.start_offset, prism_node.end_offset);

    if prism_node.is("StringNode") {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "Avoid outputting string literal `{}`. Write the text directly without wrapping it in an ERB output tag.",
          content
        ),
        location,
      ));
    } else if prism_node.is("InterpolatedStringNode") {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "Avoid outputting interpolated string `{}`. Use separate `<%= %>` tags for each dynamic value instead.",
          content
        ),
        location,
      ));
    } else {
      return;
    }

    self.walk_erb_content_node(node);
  }
}

impl Rule for ERBPreferDirectOutputRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "erb-prefer-direct-output"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.4")
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

impl ParserRule for ERBPreferDirectOutputRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, context: &LintContext) -> bool {
    let source = context.source.clone();

    if source.is_empty() {
      return false;
    }

    // the document handed to autofix is parsed without prism nodes, so the
    // replacement parts are derived from a parse that has them
    let parts = match parts_for_offense(&source, offense, <Self as Rule>::parser_options(self)) {
      Some(parts) => parts,
      None => return false,
    };

    let mut fixed = false;

    for_each_node_array_mut(document, &mut |array| {
      if fixed {
        return;
      }

      let index = array.iter().position(|node| match node {
        AnyNode::ERBContentNode(erb) => contains_position(&erb.location, offense),
        _ => false,
      });

      let index = match index {
        Some(index) => index,
        None => return,
      };

      let (tag_opening, tag_closing) = match &array[index] {
        AnyNode::ERBContentNode(erb) => (
          erb.tag_opening.as_ref().map(|token| token.value.clone()).unwrap_or_else(|| "<%=".to_string()),
          erb.tag_closing.as_ref().map(|token| token.value.clone()).unwrap_or_else(|| "%>".to_string()),
        ),
        _ => return,
      };

      let replacements: Vec<AnyNode> = parts
        .iter()
        .map(|part| match part {
          ReplacementPart::Text(content) => AnyNode::LiteralNode(Box::new(literal_node(content))),
          ReplacementPart::Expression(expression) => {
            AnyNode::ERBContentNode(Box::new(erb_output_node(&format!(" {} ", expression.trim()), &tag_opening, &tag_closing)))
          }
        })
        .collect();

      array.splice(index..index + 1, replacements);

      fixed = true;
    });

    fixed
  }

  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = PreferDirectOutputVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}

enum ReplacementPart {
  Text(String),
  Expression(String),
}

/// Splits a string / interpolated string into the literal text and embedded
/// expressions that replace it.
fn replacement_parts(prism_node: &herb::prism::PrismNode, source: &str) -> Option<Vec<ReplacementPart>> {
  if prism_node.is("StringNode") {
    return Some(vec![ReplacementPart::Text(string_content(prism_node, source))]);
  }

  if !prism_node.is("InterpolatedStringNode") {
    return None;
  }

  let mut parts = Vec::new();

  for part in &prism_node.children {
    if part.is("StringNode") {
      let content = string_content(part, source);

      if !content.is_empty() {
        parts.push(ReplacementPart::Text(content));
      }
    } else if part.is("EmbeddedStatementsNode") {
      if let Some(statements) = part.children.first() {
        let expression = source.get(statements.start_offset..statements.end_offset).unwrap_or("");

        if !expression.is_empty() {
          parts.push(ReplacementPart::Expression(expression.to_string()));
        }
      }
    }
  }

  if parts.is_empty() {
    None
  } else {
    Some(parts)
  }
}

fn string_content(node: &herb::prism::PrismNode, source: &str) -> String {
  match node.unescaped {
    Some(ref unescaped) => unescaped.clone(),
    None => source.get(node.start_offset..node.end_offset).unwrap_or("").to_string(),
  }
}

fn contains_position(location: &herb::Location, offense: &Offense) -> bool {
  let start = &offense.location.start;

  (location.start.line < start.line || (location.start.line == start.line && location.start.column <= start.column))
    && (location.end.line > start.line || (location.end.line == start.line && location.end.column >= start.column))
}

/// Re-parses with the rule's own options so the prism node behind the offense is available.
fn parts_for_offense(source: &str, offense: &Offense, options: herb::ParserOptions) -> Option<Vec<ReplacementPart>> {
  let result = herb::parse_with_options(source, &options).ok()?;
  let mut found = None;

  collect_erb(&result.value.children, &mut |erb| {
    if found.is_some() || !contains_position(&erb.location, offense) {
      return;
    }

    if let Some(ref prism_node) = erb.prism_node_ast {
      found = replacement_parts(prism_node, source);
    }
  });

  found
}

fn collect_erb(nodes: &[AnyNode], callback: &mut impl FnMut(&ERBContentNode)) {
  for node in nodes {
    match node {
      AnyNode::ERBContentNode(erb) => callback(erb),

      AnyNode::HTMLElementNode(element) => {
        if let Some(open_tag) = get_open_tag(element) {
          collect_erb(&open_tag.children, callback);
        }

        collect_erb(&element.body, callback);
      }

      AnyNode::HTMLOpenTagNode(open_tag) => collect_erb(&open_tag.children, callback),
      AnyNode::HTMLAttributeNode(attribute) => {
        if let Some(value) = attribute.value.as_ref() {
          collect_erb(&value.children, callback);
        }
      }
      AnyNode::HTMLAttributeValueNode(value) => collect_erb(&value.children, callback),

      AnyNode::ERBIfNode(node) => {
        collect_erb(&node.statements, callback);
        collect_erb_subsequent(&node.subsequent, callback);
      }

      AnyNode::ERBUnlessNode(node) => {
        collect_erb(&node.statements, callback);

        if let Some(clause) = node.else_clause.as_ref() {
          collect_erb(&clause.statements, callback);
        }
      }

      AnyNode::ERBBlockNode(node) => {
        collect_erb(&node.body, callback);

        if let Some(clause) = node.else_clause.as_ref() {
          collect_erb(&clause.statements, callback);
        }
      }

      AnyNode::ERBElseNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBWhenNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBInNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBWhileNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBUntilNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBForNode(node) => collect_erb(&node.statements, callback),
      AnyNode::ERBBeginNode(node) => collect_erb(&node.statements, callback),

      AnyNode::ERBCaseNode(node) => {
        collect_erb(&node.children, callback);
        collect_erb(&node.conditions, callback);

        if let Some(clause) = node.else_clause.as_ref() {
          collect_erb(&clause.statements, callback);
        }
      }

      AnyNode::ERBRenderNode(node) => collect_erb(&node.body, callback),

      _ => {}
    }
  }
}

fn collect_erb_subsequent(subsequent: &Option<herb::union_types::ERBElseNodeOrERBIfNode>, callback: &mut impl FnMut(&ERBContentNode)) {
  match subsequent {
    Some(herb::union_types::ERBElseNodeOrERBIfNode::ERBIfNode(node)) => {
      collect_erb(&node.statements, callback);
      collect_erb_subsequent(&node.subsequent, callback);
    }
    Some(herb::union_types::ERBElseNodeOrERBIfNode::ERBElseNode(node)) => collect_erb(&node.statements, callback),
    None => {}
  }
}
