use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use herb::herb::{parse_with_options, ParserOptions};

use crate::partial_declaration::PartialDeclaration;
use crate::partial_resolution::{self, by_precedence, partial_name_for, partial_path, template_path, view_root_for, APPLICATION_DIRECTORY};

pub struct PartialIndex {
  view_root: PathBuf,
  templates: Vec<String>,
  by_name: BTreeMap<String, Vec<String>>,
  declarations: BTreeMap<String, PartialDeclaration>,
}

fn collect_templates(directory: &Path, found: &mut Vec<String>) {
  let Ok(entries) = fs::read_dir(directory) else {
    return;
  };

  for entry in entries.flatten() {
    let path = entry.path();

    if path.is_dir() {
      collect_templates(&path, found);
    } else if let Some(text) = path.to_str() {
      if template_path(text) {
        found.push(text.to_string());
      }
    }
  }
}

impl PartialIndex {
  pub fn build(project_path: &Path) -> Self {
    let view_root = view_root_for(project_path);
    let mut templates = Vec::new();

    collect_templates(&view_root, &mut templates);
    templates.sort();

    Self::new(&view_root, templates)
  }

  pub fn resolve_view_root(project_path: &Path) -> PathBuf {
    view_root_for(project_path)
  }

  pub fn new(view_root: &Path, templates: Vec<String>) -> Self {
    let mut index = Self {
      view_root: view_root.to_path_buf(),
      templates,
      by_name: BTreeMap::new(),
      declarations: BTreeMap::new(),
    };

    index.rebuild();
    index
  }

  fn rebuild(&mut self) {
    let mut by_name: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for file in &self.templates {
      let Some(name) = self.partial_name_for(file) else {
        continue;
      };

      by_name.entry(name).or_default().push(file.clone());
    }

    for files in by_name.values_mut() {
      by_precedence(files);
    }

    self.by_name = by_name;
  }

  pub fn view_root(&self) -> &Path {
    &self.view_root
  }

  pub fn templates(&self) -> &[String] {
    &self.templates
  }

  pub fn names(&self) -> Vec<&str> {
    self.by_name.keys().map(|name| name.as_str()).collect()
  }

  pub fn size(&self) -> usize {
    self.by_name.len()
  }

  pub fn partial_name_for(&self, file: &str) -> Option<String> {
    partial_name_for(file, self.view_root.to_str()?)
  }

  pub fn files_for(&self, partial_name: &str) -> &[String] {
    self.by_name.get(partial_name).map(|files| files.as_slice()).unwrap_or(&[])
  }

  fn source_directory_for(&self, source_file: &str) -> Option<String> {
    let directory = Path::new(source_file).parent()?;
    let relative = directory.strip_prefix(&self.view_root).ok()?;

    Some(relative.to_str()?.to_string())
  }

  pub fn resolve(&self, partial_name: &str, source_file: Option<&str>) -> &[String] {
    let exact = self.files_for(partial_name);

    if !exact.is_empty() {
      return exact;
    }

    if let Some(source_file) = source_file {
      if let Some(relative) = self.source_directory_for(source_file) {
        if !relative.is_empty() && relative != "." {
          let sibling = self.files_for(&format!("{}/{}", relative, partial_name));

          if !sibling.is_empty() {
            return sibling;
          }
        }
      }
    }

    if partial_name.contains('/') {
      return &[];
    }

    self.files_for(&format!("{}/{}", APPLICATION_DIRECTORY, partial_name))
  }

  pub fn lookup(&mut self, partial_name: &str, source_file: Option<&str>) -> Option<&PartialDeclaration> {
    let file = self.resolve(partial_name, source_file).first()?.clone();

    self.declaration_for_file(&file)
  }

  pub fn declaration_for_file(&mut self, file: &str) -> Option<&PartialDeclaration> {
    if !self.declarations.contains_key(file) {
      let declaration = build_declaration(file)?;

      self.declarations.insert(file.to_string(), declaration);
    }

    self.declarations.get(file)
  }

  pub fn update(&mut self, file: &str) -> Option<String> {
    let name = self.partial_name_for(file)?;

    self.declarations.remove(file);

    if !self.templates.iter().any(|existing| existing == file) {
      self.templates.push(file.to_string());
      self.templates.sort();
    }

    let files = self.by_name.entry(name.clone()).or_default();

    if !files.iter().any(|existing| existing == file) {
      files.push(file.to_string());
    }

    by_precedence(files);

    Some(name)
  }

  pub fn remove(&mut self, file: &str) -> Option<String> {
    let name = self.partial_name_for(file)?;

    self.declarations.remove(file);
    self.templates.retain(|existing| existing != file);

    let empty = match self.by_name.get_mut(&name) {
      Some(files) => {
        files.retain(|existing| existing != file);

        files.is_empty()
      }
      None => return Some(name),
    };

    if empty {
      self.by_name.remove(&name);
    }

    Some(name)
  }
}

fn build_declaration(file: &str) -> Option<PartialDeclaration> {
  if !Path::new(file).exists() {
    return None;
  }

  let Ok(source) = fs::read_to_string(file) else {
    return Some(PartialDeclaration::without_strict_locals(file));
  };

  let mut options = ParserOptions::default();
  options.strict_locals = true;

  match parse_with_options(&source, &options) {
    Ok(result) => Some(PartialDeclaration::from_document(&result.value, file)),
    Err(_) => Some(PartialDeclaration::without_strict_locals(file)),
  }
}

pub fn glob_pattern() -> String {
  partial_resolution::template_glob_pattern()
}
