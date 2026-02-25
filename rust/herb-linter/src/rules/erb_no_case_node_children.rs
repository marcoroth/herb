use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::*;
use herb::Location;
use herb::ParseResult;
use herb::Token;
use herb::Visitor;
use herb_config::Severity;

pub struct ERBNoCaseNodeChildrenRule;

struct NoCaseNodeChildrenVisitor<'rule> {
  rule_name: &'static str,
  source_lines: Vec<&'rule str>,
  offenses: Vec<UnboundOffense>,
}

// TODO: use IdentityPrinter from herb-printer to print ERB nodes
fn print_erb_node_tokens(tag_opening: &Option<Token>, content: &Option<Token>, tag_closing: &Option<Token>) -> String {
  let mut result = String::new();

  if let Some(ref opening) = tag_opening {
    result.push_str(&opening.value);
  }

  if let Some(ref content_token) = content {
    result.push_str(&content_token.value);
  }

  if let Some(ref closing) = tag_closing {
    result.push_str(&closing.value);
  }

  result
}

fn extract_source_text(source_lines: &[&str], location: &Location) -> String {
  let start_line = location.start.line as usize;
  let end_line = location.end.line as usize;
  let start_column = location.start.column as usize;
  let end_column = location.end.column as usize;

  if start_line == 0 || end_line == 0 || start_line > source_lines.len() {
    return String::new();
  }

  if start_line == end_line {
    let line = source_lines[start_line - 1];
    let end = end_column.min(line.len());
    let start = start_column.min(end);

    return line[start..end].to_string();
  }

  let mut result = String::new();

  for line_number in start_line..=end_line.min(source_lines.len()) {
    let line = source_lines[line_number - 1];

    if line_number == start_line {
      let start = start_column.min(line.len());
      result.push_str(&line[start..]);
    } else if line_number == end_line {
      let end = end_column.min(line.len());
      result.push('\n');
      result.push_str(&line[..end]);
    } else {
      result.push('\n');
      result.push_str(line);
    }
  }

  result
}

// TODO: use IdentityPrinter from herb-printer to print nodes
fn print_node(source_lines: &[&str], node: &AnyNode) -> String {
  match node {
    AnyNode::ERBContentNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBIfNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBUnlessNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBElseNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBEndNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBWhenNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBInNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBCaseNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),
    AnyNode::ERBCaseMatchNode(erb) => print_erb_node_tokens(&erb.tag_opening, &erb.content, &erb.tag_closing),

    _ => extract_source_text(source_lines, node.location()),
  }
}

fn is_allowed_content(node: &AnyNode) -> bool {
  match node {
    AnyNode::WhitespaceNode(_) => true,
    AnyNode::HTMLCommentNode(_) => true,
    AnyNode::ERBContentNode(erb) => {
      if let Some(ref tag_opening) = erb.tag_opening {
        if tag_opening.value == "<%#" {
          return true;
        }
      }

      false
    }

    AnyNode::LiteralNode(literal) => literal.content.trim().is_empty(),
    AnyNode::HTMLTextNode(text) => text.content.trim().is_empty(),
    _ => false,
  }
}

impl<'rule> NoCaseNodeChildrenVisitor<'rule> {
  fn check_case_node_children(
    &mut self,
    tag_opening: &Option<Token>,
    content: &Option<Token>,
    tag_closing: &Option<Token>,
    children: &[AnyNode],
    conditions: &[AnyNode],
    case_type: &str,
  ) {
    if children.is_empty() {
      return;
    }

    let case_code = print_erb_node_tokens(tag_opening, content, tag_closing);

    let condition_code = conditions
      .first()
      .map(|first_condition| print_node(&self.source_lines, first_condition))
      .unwrap_or_else(|| format!("<% {} ... %>", case_type));

    for child in children {
      if !is_allowed_content(child) {
        let child_code = print_node(&self.source_lines, child).trim().to_string();

        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Do not place `{}` between `{}` and `{}`. Content here is not part of any branch and will not be rendered.",
            child_code, case_code, condition_code
          ),
          child.location().clone(),
        ));
      }
    }
  }
}

impl<'rule> Visitor for NoCaseNodeChildrenVisitor<'rule> {
  fn visit_erb_case_node(&mut self, node: &ERBCaseNode) {
    self.check_case_node_children(&node.tag_opening, &node.content, &node.tag_closing, &node.children, &node.conditions, "when");

    self.walk_erb_case_node(node);
  }

  fn visit_erb_case_match_node(&mut self, node: &ERBCaseMatchNode) {
    self.check_case_node_children(&node.tag_opening, &node.content, &node.tag_closing, &node.children, &node.conditions, "in");

    self.walk_erb_case_match_node(node);
  }
}

impl Rule for ERBNoCaseNodeChildrenRule {
  fn name(&self) -> &'static str {
    "erb-no-case-node-children"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for ERBNoCaseNodeChildrenRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let source_lines: Vec<&str> = result.source.lines().collect();

    let mut visitor = NoCaseNodeChildrenVisitor {
      rule_name: self.name(),
      source_lines,
      offenses: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
