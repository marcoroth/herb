use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::source_slice::location_from_offset;

use herb::nodes::ERBContentNode;
use herb::prism::PrismNode;
use herb::{ParseResult, Visitor};
use herb_config::{Severity, SeverityConfig};

const LITERAL_NODES: &[&str] = &[
  "ArrayNode",
  "FalseNode",
  "FloatNode",
  "HashNode",
  "ImaginaryNode",
  "IntegerNode",
  "NilNode",
  "RangeNode",
  "RationalNode",
  "RegularExpressionNode",
  "StringNode",
  "InterpolatedStringNode",
  "SymbolNode",
  "TrueNode",
];

/// Traversal stops at assignments and at control flow where literals are used
/// as return or flow values.
const OPAQUE_NODES: &[&str] = &["ReturnNode", "BreakNode", "NextNode", "MultiWriteNode", "MatchWriteNode"];

pub struct ERBNoUnusedLiteralsRule;

struct LiteralCollector<'node> {
  literals: Vec<&'node PrismNode>,
}

impl<'node> LiteralCollector<'node> {
  fn visit(&mut self, node: &'node PrismNode) {
    if node.node_type.ends_with("WriteNode") || OPAQUE_NODES.contains(&node.node_type.as_str()) {
      return;
    }

    if LITERAL_NODES.contains(&node.node_type.as_str()) {
      self.literals.push(node);
      return;
    }

    // the case operand and the `when` values are matched against, not discarded
    if node.is("CaseNode") || node.is("CaseMatchNode") {
      for condition in node.field("conditions") {
        self.visit(condition);
      }

      for clause in node.field("else_clause") {
        self.visit(clause);
      }

      return;
    }

    if node.is("WhenNode") || node.is("InNode") {
      for statement in node.field("statements") {
        self.visit(statement);
      }

      return;
    }

    // only the receiver of a call is visited, not its arguments
    if node.is("CallNode") {
      if let Some(receiver) = node.receiver() {
        self.visit(receiver);
      }

      return;
    }

    for child in &node.children {
      self.visit(child);
    }
  }
}

struct ERBNoUnusedLiteralsVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: &'rule str,
}

impl<'rule> Visitor for ERBNoUnusedLiteralsVisitor<'rule> {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if is_output_tag_opening(tag_opening) {
      return;
    }

    let prism_node = match node.prism() {
      Some(prism_node) => prism_node,
      None => return,
    };

    if self.source.is_empty() {
      return;
    }

    let mut collector = LiteralCollector { literals: Vec::new() };

    collector.visit(prism_node);

    for literal in collector.literals {
      let literal_source = self.source.get(literal.start_offset..literal.end_offset).unwrap_or("");

      self.offenses.push(UnboundOffense::with_tags(
        self.rule_name,
        format!(
          "Avoid using silent ERB tags for literals. `{}` is evaluated but never used or output.",
          literal_source
        ),
        location_from_offset(self.source, literal.start_offset, literal.end_offset),
        vec!["unnecessary".to_string()],
      ));
    }
  }
}

impl Rule for ERBNoUnusedLiteralsRule {
  fn name(&self) -> &'static str {
    "erb-no-unused-literals"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.3")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::PerMode {
      cli: Severity::Error,
      editor: Severity::Info,
    }
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBNoUnusedLiteralsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = ERBNoUnusedLiteralsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
