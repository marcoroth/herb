use herb::nodes::{AnyNode, DocumentNode};
use herb::{ERBNode, Visitor};

use crate::print_context::PrintContext;
use crate::printer::Printer;
use crate::printing_visitor::impl_printing_visitor;

#[derive(Default)]
pub struct IdentityPrinter {
  context: PrintContext,
}

impl IdentityPrinter {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn print_document(document: &DocumentNode) -> String {
    let mut printer = Self::default();

    printer.visit_document_node(document);

    printer.context.output().to_string()
  }

  pub fn print_nodes(nodes: &[AnyNode]) -> String {
    let mut printer = Self::default();

    printer.visit_all(nodes);

    printer.context.output().to_string()
  }

  pub fn print_erb_node<N: ERBNode>(node: &N) -> String {
    let mut printer = Self::default();

    printer.emit_erb(node.tag_opening(), node.content(), node.tag_closing());

    printer.context.output().to_string()
  }
}

impl Printer for IdentityPrinter {
  fn context(&mut self) -> &mut PrintContext {
    &mut self.context
  }

  fn context_ref(&self) -> &PrintContext {
    &self.context
  }
}

impl_printing_visitor!(IdentityPrinter);
