use herb::nodes::*;
use herb::union_types::*;
use herb::{ParseResult, Position, Token, Visitor};

use crate::print_context::PrintContext;

#[derive(Debug, Clone, Copy)]
pub struct PrintOptions {
  pub ignore_errors: bool,
}

impl Default for PrintOptions {
  fn default() -> Self {
    DEFAULT_PRINT_OPTIONS
  }
}

pub const DEFAULT_PRINT_OPTIONS: PrintOptions = PrintOptions { ignore_errors: false };

#[derive(Debug, Clone)]
pub struct PrintError {
  pub message: String,
}

impl std::fmt::Display for PrintError {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    formatter.write_str(&self.message)
  }
}

impl std::error::Error for PrintError {}

pub enum PrintInput<'a> {
  Token(&'a Token),
  Node(&'a AnyNode),
  Nodes(&'a [AnyNode]),
  Document(&'a DocumentNode),
  ParseResult(&'a ParseResult),
}

impl<'a> From<&'a Token> for PrintInput<'a> {
  fn from(token: &'a Token) -> Self {
    PrintInput::Token(token)
  }
}

impl<'a> From<&'a AnyNode> for PrintInput<'a> {
  fn from(node: &'a AnyNode) -> Self {
    PrintInput::Node(node)
  }
}

impl<'a> From<&'a [AnyNode]> for PrintInput<'a> {
  fn from(nodes: &'a [AnyNode]) -> Self {
    PrintInput::Nodes(nodes)
  }
}

impl<'a> From<&'a DocumentNode> for PrintInput<'a> {
  fn from(document: &'a DocumentNode) -> Self {
    PrintInput::Document(document)
  }
}

impl<'a> From<&'a ParseResult> for PrintInput<'a> {
  fn from(result: &'a ParseResult) -> Self {
    PrintInput::ParseResult(result)
  }
}

pub trait Printer: Visitor + Default {
  fn context(&mut self) -> &mut PrintContext;

  fn context_ref(&self) -> &PrintContext;

  fn write(&mut self, content: &str) {
    self.context().write(content);
  }

  fn write_text(&mut self, content: &str) {
    self.write(content);
  }

  fn write_token(&mut self, token: &Option<Token>) {
    if let Some(token) = token {
      let value = token.value.clone();

      self.write(&value);
    }
  }

  fn enter_indent(&mut self) {}
  fn exit_indent(&mut self) {}

  fn print(&mut self, input: PrintInput<'_>, options: &PrintOptions) -> Result<String, PrintError> {
    match input {
      PrintInput::Token(token) => Ok(token.value.clone()),

      PrintInput::Nodes(nodes) => {
        self.context().reset();
        self.visit_all(nodes);

        Ok(self.context_ref().output().to_string())
      }

      PrintInput::Node(node) => {
        ensure_printable(!options.ignore_errors && !node.recursive_errors().is_empty(), node.node_type())?;

        self.context().reset();
        self.visit(node);

        Ok(self.context_ref().output().to_string())
      }

      PrintInput::Document(document) => {
        self.context().reset();
        self.visit_document_node(document);

        Ok(self.context_ref().output().to_string())
      }

      PrintInput::ParseResult(result) => {
        ensure_printable(!options.ignore_errors && !result.recursive_errors().is_empty(), "DocumentNode")?;

        self.context().reset();
        self.visit_document_node(&result.value);

        Ok(self.context_ref().output().to_string())
      }
    }
  }

  fn emit_erb(&mut self, tag_opening: &Option<Token>, content: &Option<Token>, tag_closing: &Option<Token>) {
    self.write_token(tag_opening);
    self.write_token(content);
    self.write_token(tag_closing);
  }

  fn emit_document(&mut self, node: &DocumentNode) {
    self.visit_all(&node.children);
  }

  fn emit_literal(&mut self, node: &LiteralNode) {
    let content = node.content.clone();

    self.write_text(&content);
  }

  fn emit_html_text(&mut self, node: &HTMLTextNode) {
    let content = node.content.clone();

    self.write_text(&content);
  }

  fn emit_whitespace(&mut self, node: &WhitespaceNode) {
    let value = node.value.clone();

    self.write_token(&value);
  }

  fn emit_html_open_tag(&mut self, node: &HTMLOpenTagNode) {
    self.write_token(&node.tag_opening);
    self.write_token(&node.tag_name);

    self.visit_all(&node.children);

    self.write_token(&node.tag_closing);
  }

  fn emit_html_close_tag(&mut self, node: &HTMLCloseTagNode) {
    self.write_token(&node.tag_opening);

    match node.tag_name {
      Some(ref tag_name) => {
        let before: Vec<&AnyNode> = node
          .children
          .iter()
          .filter(|child| is_position_before(&child.location().end, &tag_name.location.start, true))
          .collect();

        let after: Vec<&AnyNode> = node
          .children
          .iter()
          .filter(|child| is_position_after(&child.location().start, &tag_name.location.end, true))
          .collect();

        for child in before {
          self.visit(child);
        }

        let value = tag_name.value.clone();
        self.write(&value);

        for child in after {
          self.visit(child);
        }
      }

      None => self.visit_all(&node.children),
    }

    self.write_token(&node.tag_closing);
  }

  fn emit_html_conditional_open_tag(&mut self, node: &HTMLConditionalOpenTagNode) {
    self.emit_conditional(&node.conditional);
  }

  fn emit_html_element(&mut self, node: &HTMLElementNode) {
    if let Some(ref open_tag) = node.open_tag {
      match open_tag {
        ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open) => self.emit_html_open_tag(open),

        ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(open) => {
          self.emit_erb(&open.tag_opening, &open.content, &open.tag_closing);
        }

        ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLConditionalOpenTagNode(open) => {
          self.emit_conditional(&open.conditional);
        }
      }
    }

    self.enter_indent();
    self.visit_all(&node.body);
    self.exit_indent();

    if let Some(ref close_tag) = node.close_tag {
      match close_tag {
        ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(close) => self.emit_html_close_tag(close),

        ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::ERBEndNode(close) => {
          self.emit_erb(&close.tag_opening, &close.content, &close.tag_closing);
        }

        _ => {}
      }
    }
  }

  fn emit_html_conditional_element(&mut self, node: &HTMLConditionalElementNode) {
    self.emit_conditional(&node.open_conditional);
    self.visit_all(&node.body);
    self.emit_conditional(&node.close_conditional);
  }

  fn emit_html_attribute(&mut self, node: &HTMLAttributeNode) {
    if let Some(ref name) = node.name {
      self.visit_all(&name.children);
    }

    if node.equals.is_some() {
      let equals = node.equals.clone();
      self.write_token(&equals);

      if let Some(ref value) = node.value {
        self.emit_html_attribute_value(value);
      }
    }
  }

  fn emit_html_attribute_name(&mut self, node: &HTMLAttributeNameNode) {
    self.visit_all(&node.children);
  }

  fn emit_html_attribute_value(&mut self, node: &HTMLAttributeValueNode) {
    if node.quoted {
      let quote = node.open_quote.as_ref().map(|token| token.value.clone()).unwrap_or_else(|| "\"".to_string());

      self.write(&quote);
    }

    self.visit_all(&node.children);

    if node.quoted {
      let quote = node.close_quote.as_ref().map(|token| token.value.clone()).unwrap_or_else(|| "\"".to_string());

      self.write(&quote);
    }
  }

  fn emit_ruby_literal(&mut self, node: &RubyLiteralNode) {
    let content = node.content.clone();

    self.write(&content);
  }

  fn emit_ruby_html_attributes_splat(&mut self, node: &RubyHTMLAttributesSplatNode) {
    let content = node.content.clone();

    self.write(&content);
  }

  fn emit_html_comment(&mut self, node: &HTMLCommentNode) {
    let start = node.comment_start.clone();
    let end = node.comment_end.clone();

    self.write_token(&start);
    self.visit_all(&node.children);
    self.write_token(&end);
  }

  fn emit_html_doctype(&mut self, node: &HTMLDoctypeNode) {
    let opening = node.tag_opening.clone();
    let closing = node.tag_closing.clone();

    self.write_token(&opening);
    self.visit_all(&node.children);
    self.write_token(&closing);
  }

  fn emit_xml_declaration(&mut self, node: &XMLDeclarationNode) {
    let opening = node.tag_opening.clone();
    let closing = node.tag_closing.clone();

    self.write_token(&opening);
    self.visit_all(&node.children);
    self.write_token(&closing);
  }

  fn emit_cdata(&mut self, node: &CDATANode) {
    let opening = node.tag_opening.clone();
    let closing = node.tag_closing.clone();

    self.write_token(&opening);
    self.visit_all(&node.children);
    self.write_token(&closing);
  }

  fn emit_erb_if(&mut self, node: &ERBIfNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();

    match node.subsequent {
      Some(ERBElseNodeOrERBIfNode::ERBIfNode(ref subsequent)) => self.visit_erb_if_node(subsequent),
      Some(ERBElseNodeOrERBIfNode::ERBElseNode(ref subsequent)) => self.visit_erb_else_node(subsequent),
      None => {}
    }

    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_else(&mut self, node: &ERBElseNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
  }

  fn emit_erb_block(&mut self, node: &ERBBlockNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.body);
    self.exit_indent();
    self.emit_rescue_clause(&node.rescue_clause);
    self.emit_else_clause(&node.else_clause);
    self.emit_ensure_clause(&node.ensure_clause);
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_iteration_block(&mut self, node: &ERBIterationBlockNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.body);
    self.exit_indent();
    self.emit_rescue_clause(&node.rescue_clause);
    self.emit_else_clause(&node.else_clause);
    self.emit_ensure_clause(&node.ensure_clause);
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_when(&mut self, node: &ERBWhenNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
  }

  fn emit_erb_in(&mut self, node: &ERBInNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
  }

  fn emit_erb_case(&mut self, node: &ERBCaseNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);

    self.enter_indent();
    self.visit_all(&node.children);
    self.exit_indent();

    self.enter_indent();
    self.visit_all(&node.conditions);
    self.exit_indent();

    self.enter_indent();
    self.emit_else_clause(&node.else_clause);
    self.exit_indent();

    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_case_match(&mut self, node: &ERBCaseMatchNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);

    self.enter_indent();
    self.visit_all(&node.children);
    self.exit_indent();

    self.enter_indent();
    self.visit_all(&node.conditions);
    self.exit_indent();

    self.enter_indent();
    self.emit_else_clause(&node.else_clause);
    self.exit_indent();

    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_while(&mut self, node: &ERBWhileNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_until(&mut self, node: &ERBUntilNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_for(&mut self, node: &ERBForNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_begin(&mut self, node: &ERBBeginNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_rescue_clause(&node.rescue_clause);
    self.emit_else_clause(&node.else_clause);
    self.emit_ensure_clause(&node.ensure_clause);
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_rescue(&mut self, node: &ERBRescueNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_rescue_clause(&node.subsequent);
  }

  fn emit_erb_ensure(&mut self, node: &ERBEnsureNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
  }

  fn emit_erb_unless(&mut self, node: &ERBUnlessNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
    self.enter_indent();
    self.visit_all(&node.statements);
    self.exit_indent();
    self.emit_else_clause(&node.else_clause);
    self.emit_end_node(&node.end_node);
  }

  fn emit_erb_render(&mut self, node: &ERBRenderNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);

    if node.end_node.is_some() {
      self.visit_all(&node.body);
      self.emit_rescue_clause(&node.rescue_clause);
      self.emit_else_clause(&node.else_clause);
      self.emit_ensure_clause(&node.ensure_clause);
      self.emit_end_node(&node.end_node);
    }
  }

  fn emit_conditional(&mut self, conditional: &Option<ERBIfNodeOrERBUnlessNode>) {
    match conditional {
      Some(ERBIfNodeOrERBUnlessNode::ERBIfNode(node)) => self.visit_erb_if_node(node),
      Some(ERBIfNodeOrERBUnlessNode::ERBUnlessNode(node)) => self.visit_erb_unless_node(node),
      None => {}
    }
  }

  fn emit_end_node(&mut self, end_node: &Option<Box<ERBEndNode>>) {
    if let Some(end_node) = end_node {
      self.emit_erb(&end_node.tag_opening, &end_node.content, &end_node.tag_closing);
    }
  }

  fn emit_else_clause(&mut self, clause: &Option<Box<ERBElseNode>>) {
    if let Some(clause) = clause {
      self.visit_erb_else_node(clause);
    }
  }

  fn emit_rescue_clause(&mut self, clause: &Option<Box<ERBRescueNode>>) {
    if let Some(clause) = clause {
      self.visit_erb_rescue_node(clause);
    }
  }

  fn emit_ensure_clause(&mut self, clause: &Option<Box<ERBEnsureNode>>) {
    if let Some(clause) = clause {
      self.visit_erb_ensure_node(clause);
    }
  }

  fn emit_erb_open_tag(&mut self, node: &ERBOpenTagNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn emit_erb_content(&mut self, node: &ERBContentNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn emit_erb_end(&mut self, node: &ERBEndNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn emit_erb_yield(&mut self, node: &ERBYieldNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn emit_erb_strict_locals(&mut self, node: &ERBStrictLocalsNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn emit_html_omitted_close_tag(&mut self, _node: &HTMLOmittedCloseTagNode) {}
  fn emit_html_virtual_close_tag(&mut self, _node: &HTMLVirtualCloseTagNode) {}
  fn emit_ruby_render_local(&mut self, _node: &RubyRenderLocalNode) {}
  fn emit_ruby_render_keywords(&mut self, _node: &RubyRenderKeywordsNode) {}
  fn emit_ruby_parameter(&mut self, _node: &RubyParameterNode) {}
}

fn ensure_printable(has_errors: bool, node_type: &str) -> Result<(), PrintError> {
  if has_errors {
    return Err(PrintError {
      message: format!(
        "Cannot print the node ({node_type}) since it or any of its children has parse errors. \
         Either pass in a valid node or call `print()` with `PrintOptions {{ ignore_errors: true }}`"
      ),
    });
  }

  Ok(())
}

fn is_position_before(position: &Position, other: &Position, inclusive: bool) -> bool {
  if position.line != other.line {
    return position.line < other.line;
  }

  if inclusive {
    position.column <= other.column
  } else {
    position.column < other.column
  }
}

fn is_position_after(position: &Position, other: &Position, inclusive: bool) -> bool {
  if position.line != other.line {
    return position.line > other.line;
  }

  if inclusive {
    position.column >= other.column
  } else {
    position.column > other.column
  }
}
