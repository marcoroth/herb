use herb::nodes::*;
use herb::Token;
use herb::Visitor;

rule_visitor!(HTMLNoSpaceInTagVisitor);
define_parser_rule!(HTMLNoSpaceInTagRule, "html-no-space-in-tag", Error, HTMLNoSpaceInTagVisitor, enabled: false);

const EXTRA_SPACE_NO_SPACE: &str = "Extra space detected where there should be no space.";
const EXTRA_SPACE_SINGLE_SPACE: &str = "Extra space detected where there should be a single space.";
const EXTRA_SPACE_SINGLE_BREAK: &str = "Extra space detected where there should be a single space or a single line break.";
const NO_SPACE_SINGLE_SPACE: &str = "No space detected where there should be a single space.";

fn is_whitespace_node(node: &AnyNode) -> bool {
  matches!(node, AnyNode::WhitespaceNode(_))
}

fn get_whitespace_content(node: &WhitespaceNode) -> Option<&str> {
  node.value.as_ref().map(|token| token.value.as_str())
}

fn is_self_closing(tag_closing: &Token) -> bool {
  tag_closing.value.contains('/')
}

fn get_whitespace_nodes(children: &[AnyNode]) -> Vec<(usize, &WhitespaceNode)> {
  children
    .iter()
    .enumerate()
    .filter_map(|(index, child)| match child {
      AnyNode::WhitespaceNode(whitespace) => Some((index, whitespace)),
      _ => None,
    })
    .collect()
}

impl HTMLNoSpaceInTagVisitor {
  fn check_single_line_tag(&mut self, node: &HTMLOpenTagNode) {
    let self_closing = node.tag_closing.as_ref().map(|token| is_self_closing(token)).unwrap_or(false);

    let whitespace_nodes = get_whitespace_nodes(&node.children);

    for (index, whitespace) in &whitespace_nodes {
      let content = match get_whitespace_content(whitespace) {
        Some(content) => content,
        None => continue,
      };

      let is_last_child = *index == node.children.len() - 1;

      if is_last_child {
        if self_closing && content == " " {
          continue;
        }

        self.add_offense(EXTRA_SPACE_NO_SPACE.to_string(), whitespace.location.clone());

        continue;
      }

      if content.len() > 1 {
        self.add_offense(EXTRA_SPACE_SINGLE_SPACE.to_string(), whitespace.location.clone());
      }
    }

    if self_closing {
      let needs_space = if let Some(last_child) = node.children.last() {
        !is_whitespace_node(last_child)
      } else {
        true
      };

      if needs_space {
        let last_non_whitespace = node.children.iter().rev().find(|child| !is_whitespace_node(child));

        let location_to_report = last_non_whitespace
          .map(|child| child.location())
          .or_else(|| node.tag_name.as_ref().map(|token| &token.location))
          .unwrap_or(&node.location);

        self.add_offense(NO_SPACE_SINGLE_SPACE.to_string(), location_to_report.clone());
      }
    }
  }

  fn check_multiline_tag(&mut self, node: &HTMLOpenTagNode) {
    let whitespace_nodes = get_whitespace_nodes(&node.children);
    let total_whitespace_nodes = whitespace_nodes.len();
    let mut previous_content: Option<String> = None;

    for (whitespace_index, (_child_index, whitespace)) in whitespace_nodes.iter().enumerate() {
      let content = match get_whitespace_content(whitespace) {
        Some(content) => content,
        None => continue,
      };

      if self.has_consecutive_newlines(content, previous_content.as_deref()) {
        self.add_offense(EXTRA_SPACE_SINGLE_BREAK.to_string(), whitespace.location.clone());

        previous_content = Some(content.to_string());
        continue;
      }

      if !content.contains('\n') {
        let is_last_whitespace = whitespace_index == total_whitespace_nodes - 1;

        let expected_indent = if is_last_whitespace {
          node.location.start.column
        } else {
          node.location.start.column + 2
        };

        if whitespace.location.end.column != expected_indent {
          self.add_offense(EXTRA_SPACE_NO_SPACE.to_string(), whitespace.location.clone());
        }
      }

      previous_content = Some(content.to_string());
    }
  }

  fn has_consecutive_newlines(&self, content: &str, previous_content: Option<&str>) -> bool {
    if content == "\n" {
      if let Some(previous) = previous_content {
        return previous == "\n";
      }
      return false;
    }

    if !content.contains('\n') {
      return false;
    }

    let newline_count = content.matches('\n').count();

    newline_count > 1
  }
}

impl Visitor for HTMLNoSpaceInTagVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    let is_single_line = node.location.start.line == node.location.end.line;

    if is_single_line {
      self.check_single_line_tag(node);
    } else {
      self.check_multiline_tag(node);
    }
  }

  fn visit_html_close_tag_node(&mut self, node: &HTMLCloseTagNode) {
    for child in &node.children {
      if let AnyNode::WhitespaceNode(whitespace) = child {
        self.add_offense(EXTRA_SPACE_NO_SPACE.to_string(), whitespace.location.clone());
      }
    }
  }
}
