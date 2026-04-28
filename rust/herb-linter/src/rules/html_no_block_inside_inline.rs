use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::html_data::{is_block_element, is_inline_element};

use herb::nodes::*;
use herb::union_types::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLNoBlockInsideInlineRule;

struct BlockInsideInlineVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  inline_stack: Vec<String>,
}

impl Visitor for BlockInsideInlineVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let open_tag = match &node.open_tag {
      Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(tag)) => tag,
      _ => {
        self.walk_html_element_node(node);
        return;
      }
    };

    let tag_name = match &open_tag.tag_name {
      Some(token) => token.value.to_lowercase(),
      None => {
        self.walk_html_element_node(node);
        return;
      }
    };

    let is_inline = is_inline_element(&tag_name);
    let is_block = is_block_element(&tag_name);
    let is_unknown = !is_inline && !is_block;

    if (is_block || is_unknown) && !self.inline_stack.is_empty() {
      let parent_inline = self.inline_stack.last().unwrap().clone();
      let element_type = if is_block { "Block-level" } else { "Unknown" };

      if let Some(ref tag_name_token) = open_tag.tag_name {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "{} element `<{}>` cannot be placed inside inline element `<{}>`.",
            element_type, tag_name, parent_inline
          ),
          tag_name_token.location.clone(),
        ));
      }
    }

    if is_inline {
      self.inline_stack.push(tag_name);
      self.walk_html_element_node(node);
      self.inline_stack.pop();
    } else {
      let saved_stack = std::mem::take(&mut self.inline_stack);

      self.walk_html_element_node(node);
      self.inline_stack = saved_stack;
    }
  }
}

impl Rule for HTMLNoBlockInsideInlineRule {
  fn name(&self) -> &'static str {
    "html-no-block-inside-inline"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn default_enabled(&self) -> bool {
    false
  }
}

impl ParserRule for HTMLNoBlockInsideInlineRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = BlockInsideInlineVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      inline_stack: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
