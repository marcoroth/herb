use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use herb::herb::{parse_with_options, ParserOptions};

use crate::partial_declaration::PartialDeclaration;
use crate::partial_resolution::{self, by_precedence, partial_name_for_roots, root_index_for, template_path, view_root_for, APPLICATION_DIRECTORY};

pub struct PartialIndex {
  view_roots: Vec<PathBuf>,
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
  pub fn build_with_config(project_path: &Path) -> Self {
    let mut index = Self::build(project_path);

    if let Ok(config) = herb_config::Config::load(project_path, None) {
      let files = config.find_files_for_tool(herb_config::Tool::Linter, Some(project_path));

      if !files.is_empty() {
        let mut templates: Vec<String> = files.into_iter().filter(|file| crate::partial_resolution::template_path(file)).collect();

        if !templates.is_empty() {
          let known: std::collections::BTreeSet<&String> = templates.iter().collect();
          let extra: Vec<String> = index.templates.iter().filter(|file| !known.contains(file)).cloned().collect();

          templates.extend(extra);
          templates.sort();
          templates.dedup();

          index.replace_templates(templates);
        }
      }
    }

    index
  }

  pub fn build(project_path: &Path) -> Self {
    let view_root = view_root_for(project_path);
    let mut templates = Vec::new();

    collect_templates(&view_root, &mut templates);
    templates.sort();

    Self::new(&[view_root], templates)
  }

  pub fn resolve_view_root(project_path: &Path) -> PathBuf {
    view_root_for(project_path)
  }

  pub fn new(view_roots: &[PathBuf], templates: Vec<String>) -> Self {
    let mut index = Self {
      view_roots: view_roots.to_vec(),
      templates,
      by_name: BTreeMap::new(),
      declarations: BTreeMap::new(),
    };

    index.rebuild();
    index
  }

  fn root_strings(&self) -> Vec<String> {
    self.view_roots.iter().filter_map(|root| root.to_str().map(str::to_string)).collect()
  }

  fn rebuild(&mut self) {
    let mut by_name: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for file in &self.templates {
      let Some(name) = self.partial_name_for(file) else {
        continue;
      };

      by_name.entry(name).or_default().push(file.clone());
    }

    let roots = self.root_strings();

    for files in by_name.values_mut() {
      by_precedence(files);
      files.sort_by_key(|file| root_index_for(file, &roots));
    }

    self.by_name = by_name;
  }

  pub fn view_roots(&self) -> &[PathBuf] {
    &self.view_roots
  }

  pub fn templates(&self) -> &[String] {
    &self.templates
  }

  pub fn names(&self) -> Vec<&str> {
    self.by_name.keys().map(|name| name.as_str()).collect()
  }

  pub fn names_under(&self, prefix: &str) -> Vec<&str> {
    let prefix = format!("{}/", prefix.trim_end_matches('/'));

    self.by_name.keys().filter(|name| name.starts_with(&prefix)).map(|name| name.as_str()).collect()
  }

  pub fn to_h(&mut self) -> BTreeMap<String, PartialDeclaration> {
    let names: Vec<String> = self.names().iter().map(|name| name.to_string()).collect();
    let mut partials = BTreeMap::new();

    for name in names {
      if let Some(declaration) = self.lookup(&name, None) {
        partials.insert(name, declaration.clone());
      }
    }

    partials
  }

  fn replace_templates(&mut self, templates: Vec<String>) {
    self.templates = templates;
    self.declarations.clear();
    self.rebuild();
  }

  pub fn size(&self) -> usize {
    self.by_name.len()
  }

  pub fn partial_name_for(&self, file: &str) -> Option<String> {
    partial_name_for_roots(file, &self.root_strings())
  }

  pub fn files_for(&self, partial_name: &str) -> &[String] {
    self.by_name.get(partial_name).map(|files| files.as_slice()).unwrap_or(&[])
  }

  fn source_directory_for(&self, source_file: &str) -> Option<String> {
    let directory = Path::new(source_file).parent()?;

    self
      .view_roots
      .iter()
      .find_map(|root| directory.strip_prefix(root).ok())
      .and_then(|relative| relative.to_str())
      .map(str::to_string)
  }

  pub fn resolve(&self, partial_name: &str, source_file: Option<&str>) -> Vec<String> {
    let candidates = self.candidates(partial_name, source_file);
    let Some(format) = source_file.and_then(partial_resolution::format_of) else {
      return candidates.to_vec();
    };

    let mut ordered = candidates.to_vec();
    ordered.sort_by_key(|file| {
      let matches = match partial_resolution::format_of(file) {
        Some(candidate) if candidate == format => 0,
        None => 1,
        Some(_) => 2,
      };

      (matches, usize::from(partial_resolution::variant_of(file).is_some()))
    });

    ordered
  }

  fn candidates(&self, partial_name: &str, source_file: Option<&str>) -> &[String] {
    let partial_name = partial_resolution::without_template_extension(partial_name);
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

  let options = ParserOptions {
    strict_locals: true,
    ..Default::default()
  };

  match parse_with_options(&source, &options) {
    Ok(result) => Some(PartialDeclaration::from_document(&result.value, file)),
    Err(_) => Some(PartialDeclaration::without_strict_locals(file)),
  }
}

pub fn glob_pattern() -> String {
  partial_resolution::template_glob_pattern()
}
