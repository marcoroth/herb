use crate::offense::Offense;

use herb::nodes::*;
use herb::union_types::*;

#[derive(Debug, Clone)]
pub struct AutofixResult {
  pub source: String,
  pub fixed: Vec<Offense>,
  pub unfixed: Vec<Offense>,
}

pub fn for_each_open_tag_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut HTMLOpenTagNode)) {
  walk_nodes_mut(&mut document.children, &mut |node| {
    if let AnyNode::HTMLOpenTagNode(open_tag) = node {
      callback(open_tag);
    }
  });
}

pub fn for_each_element_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut HTMLElementNode)) {
  walk_nodes_mut(&mut document.children, &mut |node| {
    if let AnyNode::HTMLElementNode(element) = node {
      callback(element);
    }
  });
}

pub fn for_each_attribute_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut HTMLAttributeNode)) {
  walk_nodes_mut(&mut document.children, &mut |node| {
    if let AnyNode::HTMLAttributeNode(attribute) = node {
      callback(attribute);
    }
  });
}

pub fn for_each_close_tag_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut HTMLCloseTagNode)) {
  walk_nodes_mut(&mut document.children, &mut |node| {
    if let AnyNode::HTMLCloseTagNode(close_tag) = node {
      callback(close_tag);
    }
  });
}

pub fn for_each_erb_mut(document: &mut DocumentNode, callback: &mut impl FnMut(ErbTokensMut<'_>)) {
  walk_nodes_mut(&mut document.children, &mut |node| {
    if let Some(tokens) = erb_tokens_mut(node) {
      callback(tokens);
    }
  });
}

pub struct ErbTokensMut<'node> {
  pub tag_opening: &'node mut Option<herb::Token>,
  pub content: &'node mut Option<herb::Token>,
  pub tag_closing: &'node mut Option<herb::Token>,
  pub location: &'node herb::Location,
}

macro_rules! erb_tokens {
  ($node:ident) => {
    Some(ErbTokensMut {
      tag_opening: &mut $node.tag_opening,
      content: &mut $node.content,
      tag_closing: &mut $node.tag_closing,
      location: &$node.location,
    })
  };
}

fn erb_tokens_mut(node: &mut AnyNode) -> Option<ErbTokensMut<'_>> {
  match node {
    AnyNode::ERBContentNode(node) => erb_tokens!(node),
    AnyNode::ERBOpenTagNode(node) => erb_tokens!(node),
    AnyNode::ERBEndNode(node) => erb_tokens!(node),
    AnyNode::ERBElseNode(node) => erb_tokens!(node),
    AnyNode::ERBIfNode(node) => erb_tokens!(node),
    AnyNode::ERBBlockNode(node) => erb_tokens!(node),
    AnyNode::ERBWhenNode(node) => erb_tokens!(node),
    AnyNode::ERBInNode(node) => erb_tokens!(node),
    AnyNode::ERBCaseNode(node) => erb_tokens!(node),
    AnyNode::ERBCaseMatchNode(node) => erb_tokens!(node),
    AnyNode::ERBWhileNode(node) => erb_tokens!(node),
    AnyNode::ERBUntilNode(node) => erb_tokens!(node),
    AnyNode::ERBForNode(node) => erb_tokens!(node),
    AnyNode::ERBRescueNode(node) => erb_tokens!(node),
    AnyNode::ERBEnsureNode(node) => erb_tokens!(node),
    AnyNode::ERBBeginNode(node) => erb_tokens!(node),
    AnyNode::ERBUnlessNode(node) => erb_tokens!(node),
    AnyNode::ERBStrictLocalsNode(node) => erb_tokens!(node),
    AnyNode::ERBYieldNode(node) => erb_tokens!(node),
    AnyNode::ERBRenderNode(node) => erb_tokens!(node),
    _ => None,
  }
}

pub fn walk_nodes_mut(nodes: &mut [AnyNode], callback: &mut impl FnMut(&mut AnyNode)) {
  for node in nodes {
    walk_node_mut(node, callback);
  }
}

pub fn walk_node_mut(node: &mut AnyNode, callback: &mut impl FnMut(&mut AnyNode)) {
  callback(node);

  match node {
    AnyNode::DocumentNode(node) => walk_nodes_mut(&mut node.children, callback),

    AnyNode::HTMLElementNode(node) => {
      if let Some(open_tag) = node.open_tag.as_mut() {
        walk_open_tag_mut(open_tag, callback);
      }

      walk_nodes_mut(&mut node.body, callback);

      if let Some(close_tag) = node.close_tag.as_mut() {
        walk_close_tag_mut(close_tag, callback);
      }
    }

    AnyNode::HTMLConditionalElementNode(node) => {
      walk_conditional_mut(&mut node.open_conditional, callback);
      walk_nodes_mut(&mut node.body, callback);
      walk_conditional_mut(&mut node.close_conditional, callback);
    }

    AnyNode::HTMLConditionalOpenTagNode(node) => walk_conditional_mut(&mut node.conditional, callback),

    AnyNode::HTMLOpenTagNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::HTMLCloseTagNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::HTMLCommentNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::HTMLDoctypeNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::XMLDeclarationNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::CDATANode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::HTMLAttributeNameNode(node) => walk_nodes_mut(&mut node.children, callback),
    AnyNode::HTMLAttributeValueNode(node) => walk_nodes_mut(&mut node.children, callback),

    AnyNode::HTMLAttributeNode(node) => {
      if let Some(name) = node.name.as_mut() {
        walk_nodes_mut(&mut name.children, callback);
      }

      if let Some(value) = node.value.as_mut() {
        walk_nodes_mut(&mut value.children, callback);
      }
    }

    AnyNode::ERBIfNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);

      match node.subsequent.as_mut() {
        Some(ERBElseNodeOrERBIfNode::ERBIfNode(subsequent)) => walk_erb_if_mut(subsequent, callback),
        Some(ERBElseNodeOrERBIfNode::ERBElseNode(subsequent)) => walk_nodes_mut(&mut subsequent.statements, callback),
        None => {}
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBUnlessNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);

      if let Some(clause) = node.else_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBBlockNode(node) => {
      walk_nodes_mut(&mut node.body, callback);

      if let Some(clause) = node.rescue_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      if let Some(clause) = node.else_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      if let Some(clause) = node.ensure_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBCaseNode(node) => {
      walk_nodes_mut(&mut node.children, callback);
      walk_nodes_mut(&mut node.conditions, callback);

      if let Some(clause) = node.else_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBCaseMatchNode(node) => {
      walk_nodes_mut(&mut node.children, callback);
      walk_nodes_mut(&mut node.conditions, callback);

      if let Some(clause) = node.else_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBWhenNode(node) => walk_nodes_mut(&mut node.statements, callback),
    AnyNode::ERBInNode(node) => walk_nodes_mut(&mut node.statements, callback),
    AnyNode::ERBWhileNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);
      walk_end_node_mut(&mut node.end_node, callback);
    }
    AnyNode::ERBUntilNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);
      walk_end_node_mut(&mut node.end_node, callback);
    }
    AnyNode::ERBForNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);
      walk_end_node_mut(&mut node.end_node, callback);
    }
    AnyNode::ERBElseNode(node) => walk_nodes_mut(&mut node.statements, callback),
    AnyNode::ERBEnsureNode(node) => walk_nodes_mut(&mut node.statements, callback),

    AnyNode::ERBBeginNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);

      if let Some(clause) = node.rescue_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      if let Some(clause) = node.else_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      if let Some(clause) = node.ensure_clause.as_mut() {
        walk_nodes_mut(&mut clause.statements, callback);
      }

      walk_end_node_mut(&mut node.end_node, callback);
    }

    AnyNode::ERBRescueNode(node) => {
      walk_nodes_mut(&mut node.statements, callback);

      if let Some(subsequent) = node.subsequent.as_mut() {
        walk_nodes_mut(&mut subsequent.statements, callback);
      }
    }

    AnyNode::ERBRenderNode(node) => {
      walk_nodes_mut(&mut node.body, callback);
      walk_nodes_mut(&mut node.block_arguments, callback);
      walk_end_node_mut(&mut node.end_node, callback);
    }

    _ => {}
  }
}

fn walk_erb_if_mut(node: &mut ERBIfNode, callback: &mut impl FnMut(&mut AnyNode)) {
  walk_nodes_mut(&mut node.statements, callback);

  match node.subsequent.as_mut() {
    Some(ERBElseNodeOrERBIfNode::ERBIfNode(subsequent)) => walk_erb_if_mut(subsequent, callback),
    Some(ERBElseNodeOrERBIfNode::ERBElseNode(subsequent)) => walk_nodes_mut(&mut subsequent.statements, callback),
    None => {}
  }

  walk_end_node_mut(&mut node.end_node, callback);
}

fn walk_conditional_mut(conditional: &mut Option<ERBIfNodeOrERBUnlessNode>, callback: &mut impl FnMut(&mut AnyNode)) {
  match conditional.as_mut() {
    Some(ERBIfNodeOrERBUnlessNode::ERBIfNode(node)) => walk_erb_if_mut(node, callback),
    Some(ERBIfNodeOrERBUnlessNode::ERBUnlessNode(node)) => {
      walk_nodes_mut(&mut node.statements, callback);
      walk_end_node_mut(&mut node.end_node, callback);
    }
    None => {}
  }
}

fn walk_open_tag_mut(open_tag: &mut ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode, callback: &mut impl FnMut(&mut AnyNode)) {
  match open_tag {
    ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node) => {
      let mut wrapped = AnyNode::HTMLOpenTagNode(std::mem::replace(node, Box::new(empty_open_tag())));
      walk_node_mut(&mut wrapped, callback);

      if let AnyNode::HTMLOpenTagNode(unwrapped) = wrapped {
        *node = unwrapped;
      }
    }

    ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(node) => {
      walk_nodes_mut(&mut node.children, callback);
    }

    ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLConditionalOpenTagNode(node) => {
      walk_conditional_mut(&mut node.conditional, callback);
    }
  }
}

fn walk_close_tag_mut(close_tag: &mut ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode, callback: &mut impl FnMut(&mut AnyNode)) {
  match close_tag {
    ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(node) => {
      let mut wrapped = AnyNode::HTMLCloseTagNode(std::mem::replace(node, Box::new(empty_close_tag())));
      walk_node_mut(&mut wrapped, callback);

      if let AnyNode::HTMLCloseTagNode(unwrapped) = wrapped {
        *node = unwrapped;
      }
    }

    ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::ERBEndNode(node) => {
      let mut wrapped = AnyNode::ERBEndNode(std::mem::replace(node, Box::new(empty_end_node())));
      walk_node_mut(&mut wrapped, callback);

      if let AnyNode::ERBEndNode(unwrapped) = wrapped {
        *node = unwrapped;
      }
    }

    _ => {}
  }
}

fn walk_end_node_mut(end_node: &mut Option<Box<herb::nodes::ERBEndNode>>, callback: &mut impl FnMut(&mut AnyNode)) {
  let Some(node) = end_node.as_mut() else {
    return;
  };

  let mut wrapped = AnyNode::ERBEndNode(std::mem::replace(node, Box::new(empty_end_node())));
  walk_node_mut(&mut wrapped, callback);

  if let AnyNode::ERBEndNode(unwrapped) = wrapped {
    *node = unwrapped;
  }
}

fn empty_end_node() -> herb::nodes::ERBEndNode {
  herb::nodes::ERBEndNode {
    node_type: String::new(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    tag_opening: None,
    content: None,
    tag_closing: None,
  }
}

fn empty_open_tag() -> HTMLOpenTagNode {
  HTMLOpenTagNode {
    node_type: String::new(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    tag_opening: None,
    tag_name: None,
    tag_closing: None,
    children: Vec::new(),
    is_void: false,
  }
}

fn empty_close_tag() -> HTMLCloseTagNode {
  HTMLCloseTagNode {
    node_type: String::new(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    tag_opening: None,
    tag_name: None,
    tag_closing: None,
    children: Vec::new(),
  }
}

pub fn location_matches(location: &herb::Location, offense: &Offense) -> bool {
  location.start.line == offense.location.start.line
    && location.start.column == offense.location.start.column
    && location.end.line == offense.location.end.line
    && location.end.column == offense.location.end.column
}

pub fn close_tag_name(element: &HTMLElementNode) -> Option<&herb::Token> {
  match element.close_tag.as_ref() {
    Some(ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(node)) => node.tag_name.as_ref(),
    _ => None,
  }
}

pub fn quote_token() -> herb::Token {
  herb::Token {
    value: "\"".to_string(),
    range: herb::Range::new(0, 0),
    location: herb::Location::from(0, 0, 0, 0),
    token_type: "TOKEN_QUOTE".to_string(),
  }
}

pub fn token(token_type: &str, value: &str) -> herb::Token {
  herb::Token {
    value: value.to_string(),
    range: herb::Range::new(0, 0),
    location: herb::Location::from(0, 0, 0, 0),
    token_type: token_type.to_string(),
  }
}

pub fn close_tag_for(tag_name: &str) -> HTMLCloseTagNode {
  HTMLCloseTagNode {
    node_type: "AST_HTML_CLOSE_TAG_NODE".to_string(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    tag_opening: Some(token("TOKEN_HTML_TAG_START_CLOSE", "</")),
    tag_name: Some(token("TOKEN_IDENTIFIER", tag_name)),
    tag_closing: Some(token("TOKEN_HTML_TAG_END", ">")),
    children: Vec::new(),
  }
}

pub fn literal_node(content: &str) -> LiteralNode {
  LiteralNode {
    node_type: "AST_LITERAL_NODE".to_string(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    content: content.to_string(),
  }
}

pub fn whitespace_node(value: &str) -> WhitespaceNode {
  WhitespaceNode {
    node_type: "AST_WHITESPACE_NODE".to_string(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    value: Some(token("TOKEN_WHITESPACE", value)),
  }
}

pub fn erb_output_node(content: &str, tag_opening: &str, tag_closing: &str) -> ERBContentNode {
  ERBContentNode {
    node_type: "AST_ERB_CONTENT_NODE".to_string(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    tag_opening: Some(token("TOKEN_ERB_START", tag_opening)),
    content: Some(token("TOKEN_ERB_CONTENT", content)),
    tag_closing: Some(token("TOKEN_ERB_END", tag_closing)),
    parsed: false,
    valid: false,
    prism_node: None,
    source: None,
    prism_cache: Default::default(),
  }
}

pub fn for_each_node_array_mut(document: &mut DocumentNode, callback: &mut impl FnMut(&mut Vec<AnyNode>)) {
  visit_array_mut(&mut document.children, callback);
}

fn visit_array_mut(array: &mut Vec<AnyNode>, callback: &mut impl FnMut(&mut Vec<AnyNode>)) {
  callback(array);

  for node in array.iter_mut() {
    match node {
      AnyNode::HTMLElementNode(node) => {
        if let Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open_tag)) = node.open_tag.as_mut() {
          visit_array_mut(&mut open_tag.children, callback);
        }

        visit_array_mut(&mut node.body, callback);
      }

      AnyNode::HTMLOpenTagNode(node) => visit_array_mut(&mut node.children, callback),
      AnyNode::HTMLCloseTagNode(node) => visit_array_mut(&mut node.children, callback),
      AnyNode::HTMLAttributeValueNode(node) => visit_array_mut(&mut node.children, callback),
      AnyNode::HTMLAttributeNameNode(node) => visit_array_mut(&mut node.children, callback),

      AnyNode::HTMLAttributeNode(node) => {
        if let Some(value) = node.value.as_mut() {
          visit_array_mut(&mut value.children, callback);
        }
      }

      AnyNode::ERBIfNode(node) => {
        visit_array_mut(&mut node.statements, callback);
        visit_subsequent_mut(&mut node.subsequent, callback);
      }

      AnyNode::ERBElseNode(node) => visit_array_mut(&mut node.statements, callback),

      AnyNode::ERBUnlessNode(node) => {
        visit_array_mut(&mut node.statements, callback);

        if let Some(clause) = node.else_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }
      }

      AnyNode::ERBBlockNode(node) => {
        visit_array_mut(&mut node.body, callback);

        if let Some(clause) = node.rescue_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }

        if let Some(clause) = node.else_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }

        if let Some(clause) = node.ensure_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }
      }

      AnyNode::ERBWhenNode(node) => visit_array_mut(&mut node.statements, callback),
      AnyNode::ERBInNode(node) => visit_array_mut(&mut node.statements, callback),
      AnyNode::ERBWhileNode(node) => visit_array_mut(&mut node.statements, callback),
      AnyNode::ERBUntilNode(node) => visit_array_mut(&mut node.statements, callback),
      AnyNode::ERBForNode(node) => visit_array_mut(&mut node.statements, callback),
      AnyNode::ERBBeginNode(node) => visit_array_mut(&mut node.statements, callback),

      AnyNode::ERBCaseNode(node) => {
        visit_array_mut(&mut node.children, callback);
        visit_array_mut(&mut node.conditions, callback);

        if let Some(clause) = node.else_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }
      }

      AnyNode::ERBCaseMatchNode(node) => {
        visit_array_mut(&mut node.children, callback);
        visit_array_mut(&mut node.conditions, callback);

        if let Some(clause) = node.else_clause.as_mut() {
          visit_array_mut(&mut clause.statements, callback);
        }
      }

      AnyNode::ERBRenderNode(node) => visit_array_mut(&mut node.body, callback),

      _ => {}
    }
  }
}

pub fn wrapper_element(template: &HTMLElementNode, body: Vec<AnyNode>) -> HTMLElementNode {
  HTMLElementNode {
    node_type: template.node_type.clone(),
    location: herb::Location::from(0, 0, 0, 0),
    errors: Vec::new(),
    open_tag: template.open_tag.clone(),
    tag_name: template.tag_name.clone(),
    body,
    close_tag: template.close_tag.clone(),
    is_void: template.is_void,
    element_source: template.element_source.clone(),
  }
}

pub fn trim_whitespace_nodes(nodes: &[AnyNode]) -> Vec<AnyNode> {
  let is_blank = |node: &AnyNode| match node {
    AnyNode::LiteralNode(literal) => literal.content.trim().is_empty(),
    AnyNode::HTMLTextNode(text) => text.content.trim().is_empty(),
    AnyNode::WhitespaceNode(_) => true,
    _ => false,
  };

  let start = nodes.iter().position(|node| !is_blank(node)).unwrap_or(nodes.len());
  let end = nodes.iter().rposition(|node| !is_blank(node)).map(|index| index + 1).unwrap_or(start);

  nodes[start..end].to_vec()
}

fn visit_subsequent_mut(subsequent: &mut Option<ERBElseNodeOrERBIfNode>, callback: &mut impl FnMut(&mut Vec<AnyNode>)) {
  match subsequent.as_mut() {
    Some(ERBElseNodeOrERBIfNode::ERBIfNode(node)) => {
      visit_array_mut(&mut node.statements, callback);
      visit_subsequent_mut(&mut node.subsequent, callback);
    }

    Some(ERBElseNodeOrERBIfNode::ERBElseNode(node)) => visit_array_mut(&mut node.statements, callback),

    None => {}
  }
}
