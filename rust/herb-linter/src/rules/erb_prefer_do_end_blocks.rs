use crate::autofix::location_matches;
use crate::offense::{Offense, UnboundOffense};
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::is_assignment_node;
use crate::utils::source_slice::location_from_content_offset;

use herb::nodes::{DocumentNode, ERBBlockNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ERBPreferDoEndBlocksRule;

impl Rule for ERBPreferDoEndBlocksRule {
  fn name(&self) -> &'static str {
    "erb-prefer-do-end-blocks"
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

fn is_brace_block(node: &ERBBlockNode) -> bool {
  node
    .end_node
    .as_ref()
    .and_then(|end_node| end_node.content.as_ref())
    .map(|content| content.value.trim_start().starts_with('}'))
    .unwrap_or(false)
}

fn brace_offset(node: &ERBBlockNode) -> Option<usize> {
  node.content.as_ref().and_then(|content| content.value.rfind('{'))
}

fn block_binds_to_same_call(prism_node: Option<&PrismNode>) -> bool {
  let mut node = match prism_node {
    Some(node) => node,
    None => return false,
  };

  // an assignment serializes its `value` last, so the assigned call is the final child
  while is_assignment_node(node) {
    node = match node.children.last() {
      Some(child) => child,
      None => return false,
    };
  }

  if !node.is("CallNode") {
    return false;
  }

  node.children.last().map(|child| child.is("BlockNode")).unwrap_or(false)
}

rule_visitor!(PreferDoEndBlocksVisitor);

impl Visitor for PreferDoEndBlocksVisitor {
  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    if is_brace_block(node) {
      if let (Some(content), Some(offset)) = (node.content.as_ref(), brace_offset(node)) {
        self.add_offense(
          "Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.",
          location_from_content_offset(content.location.start.line, content.location.start.column, &content.value, offset),
        );
      }
    }

    self.walk_erb_block_node(node);
  }
}

impl ParserRule for ERBPreferDoEndBlocksRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = PreferDoEndBlocksVisitor::new(self.name());

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }

  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let mut fixed = false;

    for_each_erb_block_mut(document, &mut |node| {
      if fixed {
        return;
      }

      if !is_brace_block(node) || !block_binds_to_same_call(node.prism()) {
        return;
      }

      let offset = match brace_offset(node) {
        Some(offset) => offset,
        None => return,
      };

      let matches = node
        .content
        .as_ref()
        .map(|content| {
          location_matches(
            &location_from_content_offset(content.location.start.line, content.location.start.column, &content.value, offset),
            offense,
          )
        })
        .unwrap_or(false);

      if !matches {
        return;
      }

      let closing_offset = match node
        .end_node
        .as_ref()
        .and_then(|end| end.content.as_ref())
        .and_then(|content| content.value.find('}'))
      {
        Some(closing_offset) => closing_offset,
        None => return,
      };

      let content = match node.content.as_mut() {
        Some(content) => content,
        None => return,
      };

      if content.value.as_bytes().get(offset) != Some(&b'{') {
        return;
      }

      let after_brace = content.value[offset + 1..].to_string();
      let keyword = if after_brace.starts_with('|') { "do " } else { "do" };

      content.value = format!("{}{}{}", &content.value[..offset], keyword, after_brace);

      if let Some(end_content) = node.end_node.as_mut().and_then(|end| end.content.as_mut()) {
        end_content.value = format!("{}end{}", &end_content.value[..closing_offset], &end_content.value[closing_offset + 1..]);
      }

      fixed = true;
    });

    fixed
  }
}

fn for_each_erb_block_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut ERBBlockNode)) {
  crate::autofix::for_each_node_array_mut(document, &mut |nodes| {
    for node in nodes.iter_mut() {
      if let herb::nodes::AnyNode::ERBBlockNode(block) = node {
        callback(block);
      }
    }
  });
}
