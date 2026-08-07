use herb::nodes::*;
use herb::union_types::*;
use herb::Visitor;

use crate::print_context::PrintContext;
use crate::printer::Printer;

#[derive(Debug, Clone, Copy, Default)]
pub struct ERBToRubyStringOptions {
  pub force_quotes: bool,
}

#[derive(Default)]
pub struct ERBToRubyStringPrinter {
  context: PrintContext,
}

impl ERBToRubyStringPrinter {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn print_node(node: &AnyNode) -> String {
    Self::print(node, &ERBToRubyStringOptions::default())
  }

  pub fn print_document(document: &DocumentNode) -> String {
    Self::print_document_with_options(document, &ERBToRubyStringOptions::default())
  }

  pub fn print_document_with_options(document: &DocumentNode, options: &ERBToRubyStringOptions) -> String {
    if let Some(result) = Self::children_shortcut(&document.children, options) {
      return result;
    }

    let mut printer = Self::new();

    printer.context.write("\"");
    printer.visit_document_node(document);
    printer.context.write("\"");

    printer.context.output().to_string()
  }

  pub fn print(node: &AnyNode, options: &ERBToRubyStringOptions) -> String {
    if let AnyNode::ERBContentNode(content) = node {
      if is_output_erb(content) && !options.force_quotes {
        return trimmed_content(&content.content);
      }
    }

    if let Some(children) = node_children(node) {
      if let Some(result) = Self::children_shortcut(children, options) {
        return result;
      }
    }

    let mut printer = Self::new();

    printer.context.write("\"");
    printer.visit(node);
    printer.context.write("\"");

    printer.context.output().to_string()
  }

  fn children_shortcut(children: &[AnyNode], options: &ERBToRubyStringOptions) -> Option<String> {
    let erb_children = erb_content_children(children);
    let has_only_erb_content = !children.is_empty() && children.len() == erb_children.len();

    if has_only_erb_content && erb_children.len() == 1 && is_output_erb(erb_children[0]) && !options.force_quotes {
      return Some(trimmed_content(&erb_children[0].content));
    }

    if children.len() == 1 && !options.force_quotes {
      match &children[0] {
        AnyNode::ERBIfNode(if_node) => {
          let mut printer = Self::new();

          if printer.can_convert_to_ternary(if_node) {
            printer.convert_to_ternary_without_wrapper(if_node);
            return Some(printer.context.output().to_string());
          }
        }

        AnyNode::ERBUnlessNode(unless_node) => {
          let mut printer = Self::new();

          if printer.can_convert_unless_to_ternary(unless_node) {
            printer.convert_unless_to_ternary_without_wrapper(unless_node);
            return Some(printer.context.output().to_string());
          }
        }

        _ => {}
      }
    }

    None
  }

  fn can_convert_to_ternary(&self, node: &ERBIfNode) -> bool {
    if matches!(node.subsequent, Some(ERBElseNodeOrERBIfNode::ERBIfNode(_))) {
      return false;
    }

    if !all_html_text(&node.statements) {
      return false;
    }

    if let Some(ERBElseNodeOrERBIfNode::ERBElseNode(ref else_node)) = node.subsequent {
      return all_html_text(&else_node.statements);
    }

    true
  }

  fn write_condition(&mut self, content: &Option<herb::Token>, keyword: &str) {
    if let Some(token) = content {
      let condition = token.value.trim();
      let clean_condition = strip_leading_keyword(condition, keyword);
      let needs_parentheses = clean_condition.contains(' ');

      if needs_parentheses {
        self.context.write("(");
      }

      self.context.write(&clean_condition);

      if needs_parentheses {
        self.context.write(")");
      }
    }
  }

  fn write_unless_condition(&mut self, content: &Option<herb::Token>) {
    if let Some(token) = content {
      let condition = token.value.trim();
      let clean_condition = strip_leading_keyword(condition, "unless");
      let needs_parentheses = clean_condition.contains(' ');

      self.context.write("!(");

      if needs_parentheses {
        self.context.write("(");
      }

      self.context.write(&clean_condition);

      if needs_parentheses {
        self.context.write(")");
      }

      self.context.write(")");
    }
  }

  fn write_ternary_branches(&mut self, then_statements: &[AnyNode], else_statements: Option<&[AnyNode]>) {
    self.context.write(" ? ");
    self.context.write("\"");

    for statement in then_statements {
      self.visit(statement);
    }

    self.context.write("\"");
    self.context.write(" : ");
    self.context.write("\"");

    if let Some(else_statements) = else_statements {
      for statement in else_statements {
        self.visit(statement);
      }
    }

    self.context.write("\"");
  }

  fn convert_to_ternary(&mut self, node: &ERBIfNode) {
    self.context.write("#{");
    self.write_condition(&node.content, "if");
    self.write_ternary_branches(&node.statements, else_statements(&node.subsequent));
    self.context.write("}");
  }

  fn convert_to_ternary_without_wrapper(&mut self, node: &ERBIfNode) {
    if matches!(node.subsequent, Some(ERBElseNodeOrERBIfNode::ERBIfNode(_))) {
      return;
    }

    self.write_condition(&node.content, "if");
    self.write_ternary_branches(&node.statements, else_statements(&node.subsequent));
  }

  fn can_convert_unless_to_ternary(&self, node: &ERBUnlessNode) -> bool {
    if !all_html_text(&node.statements) {
      return false;
    }

    if let Some(ref else_node) = node.else_clause {
      return all_html_text(&else_node.statements);
    }

    true
  }

  fn convert_unless_to_ternary(&mut self, node: &ERBUnlessNode) {
    self.context.write("#{");
    self.write_unless_condition(&node.content);
    self.write_ternary_branches(&node.statements, node.else_clause.as_ref().map(|clause| clause.statements.as_slice()));
    self.context.write("}");
  }

  fn convert_unless_to_ternary_without_wrapper(&mut self, node: &ERBUnlessNode) {
    self.write_unless_condition(&node.content);
    self.write_ternary_branches(&node.statements, node.else_clause.as_ref().map(|clause| clause.statements.as_slice()));
  }
}

impl Printer for ERBToRubyStringPrinter {
  fn context(&mut self) -> &mut PrintContext {
    &mut self.context
  }

  fn context_ref(&self) -> &PrintContext {
    &self.context
  }
}

impl Visitor for ERBToRubyStringPrinter {
  fn visit_html_text_node(&mut self, node: &HTMLTextNode) {
    let escaped = node.content.replace('\\', "\\\\").replace('"', "\\\"");
    self.context.write(&escaped);
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if is_output_erb(node) {
      self.context.write("#{");

      if let Some(ref token) = node.content {
        self.context.write(token.value.trim());
      }

      self.context.write("}");
    }
  }

  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    if self.can_convert_to_ternary(node) {
      self.convert_to_ternary(node);
    }
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    if self.can_convert_unless_to_ternary(node) {
      self.convert_unless_to_ternary(node);
    }
  }

  fn visit_html_attribute_value_node(&mut self, node: &HTMLAttributeValueNode) {
    self.visit_all(&node.children);
  }

  fn visit_document_node(&mut self, node: &DocumentNode) {
    self.emit_document(node);
  }

  fn visit_literal_node(&mut self, node: &LiteralNode) {
    self.emit_literal(node);
  }

  fn visit_whitespace_node(&mut self, node: &WhitespaceNode) {
    self.emit_whitespace(node);
  }

  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.emit_html_open_tag(node);
  }

  fn visit_html_close_tag_node(&mut self, node: &HTMLCloseTagNode) {
    self.emit_html_close_tag(node);
  }

  fn visit_html_conditional_open_tag_node(&mut self, node: &HTMLConditionalOpenTagNode) {
    self.emit_html_conditional_open_tag(node);
  }

  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.emit_html_element(node);
  }

  fn visit_html_conditional_element_node(&mut self, node: &HTMLConditionalElementNode) {
    self.emit_html_conditional_element(node);
  }

  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    self.emit_html_attribute(node);
  }

  fn visit_html_attribute_name_node(&mut self, node: &HTMLAttributeNameNode) {
    self.emit_html_attribute_name(node);
  }

  fn visit_ruby_literal_node(&mut self, node: &RubyLiteralNode) {
    self.emit_ruby_literal(node);
  }

  fn visit_ruby_html_attributes_splat_node(&mut self, node: &RubyHTMLAttributesSplatNode) {
    self.emit_ruby_html_attributes_splat(node);
  }

  fn visit_html_comment_node(&mut self, node: &HTMLCommentNode) {
    self.emit_html_comment(node);
  }

  fn visit_html_doctype_node(&mut self, node: &HTMLDoctypeNode) {
    self.emit_html_doctype(node);
  }

  fn visit_xml_declaration_node(&mut self, node: &XMLDeclarationNode) {
    self.emit_xml_declaration(node);
  }

  fn visit_cdata_node(&mut self, node: &CDATANode) {
    self.emit_cdata(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn visit_erb_end_node(&mut self, node: &ERBEndNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn visit_erb_yield_node(&mut self, node: &ERBYieldNode) {
    self.emit_erb(&node.tag_opening, &node.content, &node.tag_closing);
  }

  fn visit_erb_else_node(&mut self, node: &ERBElseNode) {
    self.emit_erb_else(node);
  }

  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.emit_erb_block(node);
  }

  fn visit_erb_when_node(&mut self, node: &ERBWhenNode) {
    self.emit_erb_when(node);
  }

  fn visit_erb_in_node(&mut self, node: &ERBInNode) {
    self.emit_erb_in(node);
  }

  fn visit_erb_case_node(&mut self, node: &ERBCaseNode) {
    self.emit_erb_case(node);
  }

  fn visit_erb_case_match_node(&mut self, node: &ERBCaseMatchNode) {
    self.emit_erb_case_match(node);
  }

  fn visit_erb_while_node(&mut self, node: &ERBWhileNode) {
    self.emit_erb_while(node);
  }

  fn visit_erb_until_node(&mut self, node: &ERBUntilNode) {
    self.emit_erb_until(node);
  }

  fn visit_erb_for_node(&mut self, node: &ERBForNode) {
    self.emit_erb_for(node);
  }

  fn visit_erb_begin_node(&mut self, node: &ERBBeginNode) {
    self.emit_erb_begin(node);
  }

  fn visit_erb_rescue_node(&mut self, node: &ERBRescueNode) {
    self.emit_erb_rescue(node);
  }

  fn visit_erb_ensure_node(&mut self, node: &ERBEnsureNode) {
    self.emit_erb_ensure(node);
  }

  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.emit_erb_render(node);
  }
}

fn is_output_erb(node: &ERBContentNode) -> bool {
  node.tag_opening.as_ref().is_some_and(|token| token.value == "<%=" || token.value == "<%==")
}

fn trimmed_content(content: &Option<herb::Token>) -> String {
  content.as_ref().map(|token| token.value.trim().to_string()).unwrap_or_default()
}

fn all_html_text(nodes: &[AnyNode]) -> bool {
  nodes.iter().all(|node| matches!(node, AnyNode::HTMLTextNode(_)))
}

fn else_statements(subsequent: &Option<ERBElseNodeOrERBIfNode>) -> Option<&[AnyNode]> {
  match subsequent {
    Some(ERBElseNodeOrERBIfNode::ERBElseNode(else_node)) => Some(&else_node.statements),
    _ => None,
  }
}

fn strip_leading_keyword(condition: &str, keyword: &str) -> String {
  if let Some(rest) = condition.strip_prefix(keyword) {
    if rest.starts_with([' ', '\t', '\n', '\r']) {
      return rest.trim_start().to_string();
    }
  }

  condition.to_string()
}

fn node_children(node: &AnyNode) -> Option<&[AnyNode]> {
  match node {
    AnyNode::DocumentNode(n) => Some(&n.children),
    AnyNode::HTMLOpenTagNode(n) => Some(&n.children),
    AnyNode::HTMLCloseTagNode(n) => Some(&n.children),
    AnyNode::HTMLAttributeValueNode(n) => Some(&n.children),
    AnyNode::HTMLAttributeNameNode(n) => Some(&n.children),
    AnyNode::ERBOpenTagNode(n) => Some(&n.children),
    AnyNode::HTMLCommentNode(n) => Some(&n.children),
    AnyNode::HTMLDoctypeNode(n) => Some(&n.children),
    AnyNode::XMLDeclarationNode(n) => Some(&n.children),
    AnyNode::CDATANode(n) => Some(&n.children),
    AnyNode::ERBCaseNode(n) => Some(&n.children),
    AnyNode::ERBCaseMatchNode(n) => Some(&n.children),
    _ => None,
  }
}

fn erb_content_children(children: &[AnyNode]) -> Vec<&ERBContentNode> {
  children
    .iter()
    .filter_map(|child| match child {
      AnyNode::ERBContentNode(node) => Some(node.as_ref()),
      _ => None,
    })
    .collect()
}
