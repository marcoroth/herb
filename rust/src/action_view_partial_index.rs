use std::collections::HashMap;

use crate::action_view_partial_resolution::{partial_name_for_file, resolve_partial, PartialPaths, PARTIAL_EXTENSIONS};
use crate::nodes::{AnyNode, DocumentNode};

const KEYWORD_KIND: &str = "keyword";
const KEYWORD_REST_KIND: &str = "keyword_rest";

pub const STRICT_LOCALS_MARKER: &str = "locals";

fn variant_rank() -> usize {
  PARTIAL_EXTENSIONS.len()
}

#[derive(Clone, Debug)]
pub struct StrictLocal {
  pub name: String,
  pub required: bool,
}

#[derive(Clone, Debug)]
pub struct PartialDeclaration {
  pub file: String,
  pub has_declaration: bool,
  pub has_keyword_rest: bool,
  pub locals: Vec<StrictLocal>,
}

#[derive(Clone, Debug)]
pub struct SerializedPartialIndex {
  pub view_root: String,
  pub partials: HashMap<String, PartialDeclaration>,
}

pub fn template_rank(file: &str) -> usize {
  let separated = file.replace('\\', "/");

  let base = match separated.rfind('/') {
    Some(index) => &separated[index + 1..],
    None => separated.as_str(),
  };

  let dot = match base.find('.') {
    Some(dot) => dot,
    None => return variant_rank(),
  };

  PARTIAL_EXTENSIONS
    .iter()
    .position(|extension| *extension == &base[dot..])
    .unwrap_or_else(variant_rank)
}

pub fn outranks_template(candidate: &str, incumbent: &str) -> bool {
  let candidate_rank = template_rank(candidate);
  let incumbent_rank = template_rank(incumbent);

  if candidate_rank != incumbent_rank {
    return candidate_rank < incumbent_rank;
  }

  candidate < incumbent
}

pub fn declaration_without_strict_locals(file: &str) -> PartialDeclaration {
  PartialDeclaration {
    file: file.to_string(),
    has_declaration: false,
    has_keyword_rest: false,
    locals: Vec::new(),
  }
}

pub fn declaration_from_document(document: &DocumentNode, file: &str) -> PartialDeclaration {
  let mut declaration = declaration_without_strict_locals(file);

  for child in &document.children {
    let child = match child {
      AnyNode::ERBStrictLocalsNode(child) => child,
      _ => continue,
    };

    declaration.has_declaration = true;

    for local in &child.locals {
      let local = match local {
        AnyNode::RubyParameterNode(local) => local,
        _ => continue,
      };

      if local.kind == KEYWORD_REST_KIND {
        declaration.has_keyword_rest = true;
        continue;
      }

      if local.kind != KEYWORD_KIND {
        continue;
      }

      if let Some(name) = local.name.as_ref() {
        declaration.locals.push(StrictLocal {
          name: name.value.clone(),
          required: local.required,
        });
      }
    }
  }

  declaration
}

#[derive(Clone, Debug, Default)]
pub struct PartialIndex {
  pub view_root: String,
  declarations: HashMap<String, PartialDeclaration>,
  files: PartialPaths,
  by_file: HashMap<String, PartialDeclaration>,
}

impl PartialIndex {
  pub fn from_serialized(data: SerializedPartialIndex) -> Self {
    Self::new(data.view_root, data.partials)
  }

  pub fn new(view_root: String, declarations: HashMap<String, PartialDeclaration>) -> Self {
    let mut files = PartialPaths::new();
    let mut by_file = HashMap::new();

    for (name, declaration) in &declarations {
      files.insert(name.clone(), declaration.file.clone());
      by_file.insert(declaration.file.clone(), declaration.clone());
    }

    Self {
      view_root,
      declarations,
      files,
      by_file,
    }
  }

  pub fn lookup(&self, partial_name: &str, source_file: Option<&str>) -> Option<&PartialDeclaration> {
    let file = resolve_partial(partial_name, source_file.unwrap_or(""), &self.files, &self.view_root)?;

    self.by_file.get(&file)
  }

  pub fn update(&mut self, declaration: PartialDeclaration) -> Option<String> {
    let name = partial_name_for_file(&declaration.file, &self.view_root)?;

    if let Some(existing) = self.declarations.get(&name) {
      if existing.file != declaration.file {
        if !outranks_template(&declaration.file, &existing.file) {
          return None;
        }

        let existing_file = existing.file.clone();
        self.by_file.remove(&existing_file);
      }
    }

    self.files.insert(name.clone(), declaration.file.clone());
    self.by_file.insert(declaration.file.clone(), declaration.clone());
    self.declarations.insert(name.clone(), declaration);

    Some(name)
  }

  pub fn remove(&mut self, file: &str) -> Option<String> {
    let name = partial_name_for_file(file, &self.view_root)?;

    match self.declarations.get(&name) {
      Some(existing) if existing.file == file => {}
      _ => return None,
    }

    self.declarations.remove(&name);
    self.files.remove(&name);
    self.by_file.remove(file);

    Some(name)
  }

  pub fn len(&self) -> usize {
    self.declarations.len()
  }

  pub fn is_empty(&self) -> bool {
    self.declarations.is_empty()
  }

  pub fn to_serialized(&self) -> SerializedPartialIndex {
    SerializedPartialIndex {
      view_root: self.view_root.clone(),
      partials: self.declarations.clone(),
    }
  }
}
