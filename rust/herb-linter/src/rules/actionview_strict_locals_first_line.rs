use crate::autofix::literal_node;
use crate::offense::Offense;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;

use herb::nodes::{AnyNode, DocumentNode, ERBStrictLocalsNode};
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct ActionViewStrictLocalsFirstLineRule;

rule_visitor!(ActionViewStrictLocalsFirstLineVisitor);

impl Visitor for ActionViewStrictLocalsFirstLineVisitor {
  fn visit_document_node(&mut self, node: &DocumentNode) {
    for (index, child) in node.children.iter().enumerate() {
      if !matches!(child, AnyNode::ERBStrictLocalsNode(_)) {
        continue;
      }

      let next = match node.children.get(index + 1) {
        Some(next) => next,
        None => break,
      };

      let location = child.location().clone();

      match next {
        AnyNode::HTMLTextNode(text) => {
          if !text.content.starts_with("\n\n") && node.children.get(index + 2).is_some() {
            self.add_offense("Add a blank line after the strict locals declaration.", location);
          }
        }

        _ => self.add_offense("Add a blank line after the strict locals declaration.", location),
      }

      break;
    }

    self.walk_document_node(node);
  }

  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    if node.location.start.line != 1 {
      self.add_offense("Strict locals declaration must be on the first line of the partial.", node.location.clone());
    }
  }
}

impl Rule for ActionViewStrictLocalsFirstLineRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "actionview-strict-locals-first-line"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn default_enabled(&self) -> bool {
    false
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      strict_locals: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ActionViewStrictLocalsFirstLineRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let children = &mut document.children;

    let index = children
      .iter()
      .position(|child| child.location().start.line == offense.location.start.line && child.location().start.column == offense.location.start.column);

    let index = match index {
      Some(index) => index,
      None => return false,
    };

    if offense.location.start.line == 1 {
      let replaces_existing_text = matches!(children.get(index + 1), Some(AnyNode::HTMLTextNode(_)));

      if replaces_existing_text {
        children[index + 1] = AnyNode::LiteralNode(Box::new(literal_node("\n\n")));
      } else {
        children.insert(index + 1, AnyNode::LiteralNode(Box::new(literal_node("\n\n"))));
      }

      return true;
    }

    let node = children.remove(index);

    if index > 0 {
      let previous_is_blank = matches!(children.get(index - 1), Some(AnyNode::HTMLTextNode(text)) if text.content.trim().is_empty());

      if previous_is_blank {
        children.remove(index - 1);
      }
    }

    let needs_blank_line = !matches!(children.first(), Some(AnyNode::HTMLTextNode(text)) if text.content.starts_with("\n\n"));

    if needs_blank_line {
      children.insert(0, AnyNode::LiteralNode(Box::new(literal_node("\n\n"))));
    }

    children.insert(0, node);

    true
  }

  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let is_partial = context.file_name.as_deref().map(is_partial_file).unwrap_or(false);

    if !is_partial {
      return Vec::new();
    }

    let mut visitor = ActionViewStrictLocalsFirstLineVisitor::new(<Self as Rule>::name(self));

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
