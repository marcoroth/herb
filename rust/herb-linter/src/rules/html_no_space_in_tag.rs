use crate::autofix::location_matches;
use crate::offense::Offense;
use crate::rule::LintContext;
use herb::nodes::DocumentNode;
use herb::nodes::*;
use herb::Token;
use herb::Visitor;

rule_visitor!(HTMLNoSpaceInTagVisitor);
define_parser_rule!(HTMLNoSpaceInTagRule, "html-no-space-in-tag", Error, HTMLNoSpaceInTagVisitor,
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "0.10.3"
);

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
      AnyNode::WhitespaceNode(whitespace) => Some((index, whitespace.as_ref())),
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
    let last_child_index = node.children.len().saturating_sub(1);
    let self_closing = node.tag_closing.as_ref().map(is_self_closing).unwrap_or(false);
    let mut previous_content: Option<String> = None;

    for (index, child) in node.children.iter().enumerate() {
      // a non-whitespace child breaks the run, so two newlines separated by an
      // attribute are not consecutive
      let whitespace = match child {
        AnyNode::WhitespaceNode(whitespace) => whitespace.as_ref(),
        _ => {
          previous_content = None;
          continue;
        }
      };

      let child_index = &index;

      let content = match get_whitespace_content(whitespace) {
        Some(content) => content,
        None => {
          previous_content = Some(String::new());
          continue;
        }
      };

      if self.has_consecutive_newlines(content, previous_content.as_deref()) {
        self.add_offense(EXTRA_SPACE_SINGLE_BREAK.to_string(), whitespace.location.clone());

        previous_content = Some(content.to_string());
        continue;
      }

      if !content.contains('\n') {
        let is_line_leading = previous_content.as_deref().map(|previous| previous.contains('\n')).unwrap_or(false);
        let is_last_child = *child_index == last_child_index;

        if is_line_leading {
          // only the whitespace before the closing bracket has to line up with
          // the tag itself; attributes may hang at any indent
          if is_last_child && whitespace.location.end.column != node.location.start.column {
            self.add_offense(EXTRA_SPACE_NO_SPACE.to_string(), whitespace.location.clone());
          }
        } else {
          self.check_inline_whitespace(whitespace, content, is_last_child, self_closing);
        }
      }

      previous_content = Some(content.to_string());
    }
  }

  fn check_inline_whitespace(&mut self, whitespace: &WhitespaceNode, content: &str, is_last_child: bool, self_closing: bool) {
    if is_last_child {
      if self_closing {
        if content != " " {
          self.add_offense(EXTRA_SPACE_SINGLE_SPACE.to_string(), whitespace.location.clone());
        }

        return;
      }

      self.add_offense(EXTRA_SPACE_NO_SPACE.to_string(), whitespace.location.clone());

      return;
    }

    if content.len() > 1 {
      self.add_offense(EXTRA_SPACE_SINGLE_SPACE.to_string(), whitespace.location.clone());
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

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  crate::autofix::for_each_open_tag_mut(document, &mut |open_tag| {
    let self_closing = open_tag.tag_closing.as_ref().map(|token| token.value == "/>").unwrap_or(false);

    // no whitespace before `/>`: append one
    if offense.message == NO_SPACE_SINGLE_SPACE {
      let matches_tag = open_tag
        .tag_name
        .as_ref()
        .map(|token| location_matches(&token.location, offense))
        .unwrap_or(false)
        || open_tag
          .tag_closing
          .as_ref()
          .map(|token| location_matches(&token.location, offense))
          .unwrap_or(false)
        || location_matches(&open_tag.location, offense)
        || open_tag
          .children
          .iter()
          .rev()
          .find(|child| !matches!(child, AnyNode::WhitespaceNode(_)))
          .map(|child| location_matches(child.location(), offense))
          .unwrap_or(false);

      if matches_tag {
        open_tag.children.push(AnyNode::WhitespaceNode(Box::new(crate::autofix::whitespace_node(" "))));
        fixed = true;
      }

      return;
    }

    for child in open_tag.children.iter_mut() {
      let whitespace = match child {
        AnyNode::WhitespaceNode(whitespace) => whitespace,
        _ => continue,
      };

      if !location_matches(&whitespace.location, offense) {
        continue;
      }

      let beginning_of_line = whitespace.location.start.column == 0;

      let value = match whitespace.value.as_mut() {
        Some(value) => value,
        None => continue,
      };

      if offense.message == EXTRA_SPACE_NO_SPACE {
        value.value = if self_closing && !beginning_of_line { " ".to_string() } else { String::new() };
        fixed = true;
      } else if offense.message == EXTRA_SPACE_SINGLE_BREAK {
        value.value = if value.value.contains('\n') { String::new() } else { " ".to_string() };
        fixed = true;
      } else if offense.message == EXTRA_SPACE_SINGLE_SPACE {
        value.value = " ".to_string();
        fixed = true;
      }
    }
  });

  crate::autofix::walk_nodes_mut(&mut document.children, &mut |node| {
    let close_tag = match node {
      AnyNode::HTMLCloseTagNode(close_tag) => close_tag,
      _ => return,
    };

    for child in close_tag.children.iter_mut() {
      let whitespace = match child {
        AnyNode::WhitespaceNode(whitespace) => whitespace,
        _ => continue,
      };

      if !location_matches(&whitespace.location, offense) {
        continue;
      }

      let value = match whitespace.value.as_mut() {
        Some(value) => value,
        None => continue,
      };

      if offense.message == EXTRA_SPACE_NO_SPACE {
        value.value = String::new();
        fixed = true;
      }
    }
  });

  fixed
}
