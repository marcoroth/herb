use std::collections::HashMap;
use std::path::Path;

use herb::action_view_partial_index::{
  declaration_from_document, declaration_without_strict_locals, outranks_template, PartialDeclaration, PartialIndex, STRICT_LOCALS_MARKER,
};
use herb::action_view_partial_resolution::{is_partial_path, partial_name_for_file, PARTIAL_GLOB_PATTERN};

const VIEW_ROOT_CANDIDATE: &str = "app/views";
const PROJECT_ROOT: &str = ".";

fn parser_options() -> herb::ParserOptions {
  herb::ParserOptions {
    strict_locals: true,
    ..Default::default()
  }
}

fn partials_in(project_path: &Path, view_root: &str) -> Vec<String> {
  let pattern = if view_root == PROJECT_ROOT {
    format!("**/{PARTIAL_GLOB_PATTERN}")
  } else {
    format!("{view_root}/**/{PARTIAL_GLOB_PATTERN}")
  };

  herb_config::glob::glob(&[pattern], project_path, &[] as &[String])
}

pub fn find_view_root(project_path: &Path) -> String {
  if partials_in(project_path, VIEW_ROOT_CANDIDATE).is_empty() {
    PROJECT_ROOT.to_string()
  } else {
    VIEW_ROOT_CANDIDATE.to_string()
  }
}

pub fn declaration_from_source(file: &str, source: &str) -> PartialDeclaration {
  if !source.contains(STRICT_LOCALS_MARKER) {
    return declaration_without_strict_locals(file);
  }

  match herb::parse_with_options(source, &parser_options()) {
    Ok(result) => declaration_from_document(&result.value, file),
    Err(_) => declaration_without_strict_locals(file),
  }
}

pub fn declaration_from_file(project_path: &Path, file: &str) -> Option<PartialDeclaration> {
  let source = std::fs::read_to_string(project_path.join(file)).ok()?;

  Some(declaration_from_source(file, &source))
}

pub fn build_partial_index(project_path: &Path) -> PartialIndex {
  let view_root = find_view_root(project_path);
  let mut files = partials_in(project_path, &view_root);
  let mut declarations: HashMap<String, PartialDeclaration> = HashMap::new();

  files.sort();

  for file in files {
    let name = match partial_name_for_file(&file, &view_root) {
      Some(name) => name,
      None => continue,
    };

    if let Some(existing) = declarations.get(&name) {
      if !outranks_template(&file, &existing.file) {
        continue;
      }
    }

    if let Some(declaration) = declaration_from_file(project_path, &file) {
      declarations.insert(name, declaration);
    }
  }

  PartialIndex::new(view_root, declarations)
}

pub fn refresh_partial_after_fix(index: &mut PartialIndex, file: &str, before: &str, after: &str) -> bool {
  if !is_partial_path(file) {
    return false;
  }

  let previous = declaration_from_source(file, before);
  let current = declaration_from_source(file, after);

  if declarations_match(&previous, &current) {
    return false;
  }

  index.update(current).is_some()
}

fn declarations_match(a: &PartialDeclaration, b: &PartialDeclaration) -> bool {
  a.has_declaration == b.has_declaration
    && a.has_keyword_rest == b.has_keyword_rest
    && a.locals.len() == b.locals.len()
    && a
      .locals
      .iter()
      .zip(&b.locals)
      .all(|(left, right)| left.name == right.name && left.required == right.required)
}
