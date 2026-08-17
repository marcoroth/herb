pub mod local;
pub mod named_reference;
pub mod offset_table;
pub mod reference_collector;

use std::collections::BTreeSet;

use herb::herb::{parse_with_options, ParserOptions};
use herb::location::Location;
use herb::nodes::AnyNode;

pub use local::Local;
pub use named_reference::NamedReference;
pub use offset_table::OffsetTable;
pub use reference_collector::ReferenceCollector;

const KEYWORD_KIND: &str = "keyword";

#[derive(Debug, Default)]
pub struct RubyLocalsIndex {
  pub locals: Vec<Local>,
  pub assignment_names: BTreeSet<String>,
}

impl RubyLocalsIndex {
  pub fn from_source(source: &str) -> Self {
    let options = ParserOptions {
      prism_program: true,
      strict_locals: true,
      ..Default::default()
    };

    let Ok(result) = parse_with_options(source, &options) else {
      return Self::default();
    };

    Self::from_document(&result.value, source)
  }

  pub fn from_document(document: &herb::nodes::DocumentNode, source: &str) -> Self {
    let Some(program) = document.prism() else {
      return Self::default();
    };

    let offsets = OffsetTable::new(source);
    let references = ReferenceCollector::new(program);

    let mut locals = strict_locals(document, &references, &offsets);
    locals.extend(block_locals(document, &references, &offsets));

    Self {
      locals,
      assignment_names: references.assignments.iter().map(|reference| reference.name.clone()).collect(),
    }
  }

  pub fn at(&self, line: u32, column: u32) -> Option<&Local> {
    self
      .locals
      .iter()
      .filter(|local| local.locations().iter().any(|location| covers(location, line, column)))
      .reduce(|a, b| if encloses(&b.declaration, &a.declaration) { a } else { b })
  }

  pub fn find(&self, name: &str) -> Option<&Local> {
    self.locals.iter().find(|local| local.name == name)
  }

  pub fn names(&self) -> BTreeSet<String> {
    self.locals.iter().map(|local| local.name.clone()).collect()
  }
}

fn covers(location: &Location, line: u32, column: u32) -> bool {
  if line < location.start.line || line > location.end.line {
    return false;
  }

  if line == location.start.line && column < location.start.column {
    return false;
  }

  if line == location.end.line && column > location.end.column {
    return false;
  }

  true
}

fn encloses(outer: &Location, inner: &Location) -> bool {
  covers(outer, inner.start.line, inner.start.column) && covers(outer, inner.end.line, inner.end.column)
}

fn strict_locals(document: &herb::nodes::DocumentNode, references: &ReferenceCollector, offsets: &OffsetTable) -> Vec<Local> {
  declarations(document)
    .into_iter()
    .map(|(name, location)| {
      let usages = references
        .bare_calls
        .iter()
        .filter(|call| call.name == name)
        .map(|call| offsets.location_for(call))
        .collect();

      Local::new(name, location, usages)
    })
    .collect()
}

fn declarations(document: &herb::nodes::DocumentNode) -> Vec<(String, Location)> {
  let mut found = Vec::new();

  for child in &document.children {
    let AnyNode::ERBStrictLocalsNode(node) = child else {
      continue;
    };

    for local in &node.locals {
      if let Some(declaration) = declaration_for(local) {
        found.push(declaration);
      }
    }
  }

  found
}

fn declaration_for(local: &AnyNode) -> Option<(String, Location)> {
  let AnyNode::RubyParameterNode(parameter) = local else {
    return None;
  };

  if parameter.kind != KEYWORD_KIND {
    return None;
  }

  let token = parameter.name.as_ref()?;
  let name = token.value.clone();
  let start = token.location.start;

  Some((
    name.clone(),
    Location::from(start.line, start.column, start.line, start.column + name.len() as u32),
  ))
}

fn block_locals(document: &herb::nodes::DocumentNode, references: &ReferenceCollector, offsets: &OffsetTable) -> Vec<Local> {
  let blocks = block_locations(document);

  references
    .parameters
    .iter()
    .chain(references.assignments.iter())
    .map(|reference| {
      let location = offsets.location_for(reference);
      let scope = innermost_enclosing(&blocks, &location);

      Local::new(reference.name.clone(), location, reads_in_scope(reference, references, offsets, scope))
    })
    .collect()
}

fn reads_in_scope(reference: &NamedReference, references: &ReferenceCollector, offsets: &OffsetTable, scope: Option<&Location>) -> Vec<Location> {
  references
    .local_reads
    .iter()
    .filter(|read| read.name == reference.name)
    .map(|read| offsets.location_for(read))
    .filter(|usage| scope.is_none_or(|scope| encloses(scope, usage)))
    .collect()
}

fn block_locations(document: &herb::nodes::DocumentNode) -> Vec<Location> {
  let mut found = Vec::new();

  for child in &document.children {
    collect_block_locations(child, &mut found);
  }

  found
}

fn collect_block_locations(node: &AnyNode, found: &mut Vec<Location>) {
  if matches!(node, AnyNode::ERBBlockNode(_) | AnyNode::ERBIterationBlockNode(_)) {
    found.push(*node.location());
  }

  for child in any_children(node) {
    collect_block_locations(child, found);
  }
}

fn any_children(node: &AnyNode) -> Vec<&AnyNode> {
  match node {
    AnyNode::DocumentNode(inner) => inner.children.iter().collect(),
    AnyNode::HTMLElementNode(inner) => inner.body.iter().collect(),
    AnyNode::HTMLAttributeValueNode(inner) => inner.children.iter().collect(),
    AnyNode::ERBIfNode(inner) => inner.statements.iter().collect(),
    AnyNode::ERBUnlessNode(inner) => inner.statements.iter().collect(),
    AnyNode::ERBCaseNode(inner) => inner.children.iter().collect(),
    AnyNode::ERBBlockNode(inner) => inner.body.iter().collect(),
    AnyNode::ERBIterationBlockNode(inner) => inner.body.iter().collect(),
    AnyNode::ERBRenderNode(inner) => inner.body.iter().collect(),
    _ => Vec::new(),
  }
}

fn innermost_enclosing<'a>(locations: &'a [Location], inner: &Location) -> Option<&'a Location> {
  locations
    .iter()
    .filter(|location| encloses(location, inner))
    .reduce(|a, b| if encloses(b, a) { a } else { b })
}
