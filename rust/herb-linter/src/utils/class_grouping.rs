use crate::utils::erb_utils::as_erb_node;

use herb::nodes::AnyNode;

pub enum ClassNode<'node> {
  Literal(String),
  Other(&'node AnyNode),
}

impl ClassNode<'_> {
  pub fn is_literal(&self) -> bool {
    matches!(self, ClassNode::Literal(_))
  }

  pub fn content(&self) -> &str {
    match self {
      ClassNode::Literal(content) => content,
      ClassNode::Other(_) => "",
    }
  }

  pub fn is_pure_whitespace(&self) -> bool {
    match self {
      ClassNode::Literal(content) => content.trim().is_empty(),

      ClassNode::Other(node) => match node {
        AnyNode::HTMLTextNode(text) => text.content.trim().is_empty(),
        AnyNode::WhitespaceNode(_) => true,
        _ => false,
      },
    }
  }

  pub fn printed(&self) -> String {
    match self {
      ClassNode::Literal(content) => content.clone(),

      ClassNode::Other(node) => match as_erb_node(node) {
        Some((tag_opening, content, _)) => {
          let closing = erb_tag_closing(node);
          format!("{}{}{}", tag_opening, content, closing)
        }

        None => String::new(),
      },
    }
  }
}

fn erb_tag_closing(node: &AnyNode) -> &str {
  macro_rules! closing {
    ($node:ident) => {
      $node.tag_closing.as_ref().map(|token| token.value.as_str()).unwrap_or("")
    };
  }

  match node {
    AnyNode::ERBContentNode(node) => closing!(node),
    AnyNode::ERBIfNode(node) => closing!(node),
    AnyNode::ERBBlockNode(node) => closing!(node),
    _ => "",
  }
}

pub fn split_literals_at_whitespace(nodes: &[AnyNode]) -> Vec<ClassNode<'_>> {
  let mut result = Vec::new();

  for node in nodes {
    match node {
      AnyNode::LiteralNode(literal) => {
        for part in split_runs(&literal.content) {
          result.push(ClassNode::Literal(part));
        }
      }

      _ => result.push(ClassNode::Other(node)),
    }
  }

  result
}

fn split_runs(content: &str) -> Vec<String> {
  let mut parts = Vec::new();
  let mut current = String::new();
  let mut current_is_whitespace = None;

  for character in content.chars() {
    let is_whitespace = character.is_whitespace();

    if current_is_whitespace != Some(is_whitespace) && !current.is_empty() {
      parts.push(std::mem::take(&mut current));
    }

    current_is_whitespace = Some(is_whitespace);
    current.push(character);
  }

  if !current.is_empty() {
    parts.push(current);
  }

  parts
}

pub fn group_nodes_by_class<'node>(nodes: Vec<ClassNode<'node>>) -> Vec<Vec<ClassNode<'node>>> {
  let mut groups: Vec<Vec<ClassNode>> = Vec::new();
  let mut current_group: Vec<ClassNode> = Vec::new();

  for (index, node) in nodes.into_iter().enumerate() {
    let previous_is_literal = current_group.last().map(|node| node.is_literal());
    let previous_content = current_group.last().map(|node| node.content().to_string());

    let mut start_new_group = false;

    if current_group.is_empty() || index == 0 {
      start_new_group = false;
    } else if node.is_literal() {
      let content = node.content();

      if content.starts_with(char::is_whitespace) {
        start_new_group = true;
      } else if content.starts_with('-') {
        start_new_group = false;
      } else if previous_is_literal == Some(false) {
        start_new_group = true;
      } else if current_group.iter().all(|member| member.is_pure_whitespace()) {
        start_new_group = true;
      }
    } else if previous_is_literal == Some(true) {
      let previous = previous_content.unwrap_or_default();

      start_new_group = !previous.ends_with('-') && !previous.is_empty();

      if previous.ends_with(char::is_whitespace) {
        start_new_group = true;
      }
    }

    if start_new_group && !current_group.is_empty() {
      groups.push(std::mem::take(&mut current_group));
    }

    current_group.push(node);
  }

  if !current_group.is_empty() {
    groups.push(current_group);
  }

  groups
}
