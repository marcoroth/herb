use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::path::PathBuf;
use std::time::{Duration, Instant};

use rubydex::indexing::{self, IndexerBackend, LanguageId};
use rubydex::listing;
use rubydex::model::built_in;
use rubydex::model::declaration::{Ancestor, Ancestors, Declaration, Namespace};
use rubydex::model::graph::Graph;
use rubydex::resolution::Resolver;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChainState {
  Complete,
  Partial,
  Cyclic,
}

impl ChainState {
  pub fn as_str(&self) -> &'static str {
    match self {
      ChainState::Complete => "complete",
      ChainState::Partial => "partial",
      ChainState::Cyclic => "cyclic",
    }
  }
}

#[derive(Debug, Clone)]
pub struct Ancestry {
  pub state: ChainState,
  pub names: Vec<String>,
  pub unresolved: usize,
}

pub struct Analysis {
  graph: Graph,
  timings: Vec<(&'static str, Duration)>,
  index_errors: Vec<String>,
  files_indexed: usize,
}

impl Analysis {
  pub fn index_sources(sources: &[(&str, &str)]) -> Self {
    let mut graph = Graph::new();
    let started = Instant::now();

    for (uri, source) in sources {
      indexing::index_source(&mut graph, uri, source, &LanguageId::Ruby);
    }

    Self {
      graph,
      timings: vec![("index", started.elapsed())],
      index_errors: Vec::new(),
      files_indexed: sources.len(),
    }
  }

  pub fn index_paths(paths: &[String], excluded: &HashSet<PathBuf>) -> Self {
    let mut graph = Graph::new();
    let mut timings = Vec::new();
    let mut index_errors = Vec::new();

    let started = Instant::now();
    let (file_paths, listing_errors) = listing::collect_file_paths(paths.to_vec(), excluded);
    timings.push(("listing", started.elapsed()));

    for error in listing_errors {
      index_errors.push(format!("{error:?}"));
    }

    let files_indexed = file_paths.len();

    let started = Instant::now();
    let errors = indexing::index_files(&mut graph, file_paths, IndexerBackend::RubyIndexer);
    timings.push(("indexing", started.elapsed()));

    for error in errors {
      index_errors.push(format!("{error:?}"));
    }

    Self {
      graph,
      timings,
      index_errors,
      files_indexed,
    }
  }

  #[must_use]
  pub fn with_built_ins(mut self) -> Self {
    let started = Instant::now();
    built_in::add_built_in_data(&mut self.graph);
    self.timings.push(("built_ins", started.elapsed()));

    self
  }

  pub fn resolve(&mut self) -> &mut Self {
    let started = Instant::now();
    Resolver::new(&mut self.graph).resolve();
    self.timings.push(("resolution", started.elapsed()));

    self
  }

  fn declaration(&self, name: &str) -> Option<&Declaration> {
    let definitions = self.graph.get(name)?;
    let definition = definitions.first()?;
    let declaration_id = self.graph.definition_to_declaration_id(definition)?;

    self.graph.declarations().get(declaration_id)
  }

  fn namespace(&self, name: &str) -> Option<&Namespace> {
    self.declaration(name)?.as_namespace()
  }

  fn declaration_name(&self, id: &rubydex::model::ids::DeclarationId) -> Option<&str> {
    self.graph.declarations().get(id).map(Declaration::name)
  }

  pub fn ancestors_of(&self, name: &str) -> Option<Ancestry> {
    let namespace = self.namespace(name)?;
    let ancestors = namespace.ancestors();

    let state = match ancestors {
      Ancestors::Complete(_) => ChainState::Complete,
      Ancestors::Partial(_) => ChainState::Partial,
      Ancestors::Cyclic(_) => ChainState::Cyclic,
    };

    let mut names = Vec::new();
    let mut unresolved = 0;

    for ancestor in ancestors.iter() {
      match ancestor {
        Ancestor::Complete(id) => {
          if let Some(name) = self.declaration_name(id) {
            names.push(name.to_string());
          }
        }
        Ancestor::Partial(_) => {
          unresolved += 1;
          names.push("<unresolved>".to_string());
        }
      }
    }

    Some(Ancestry { state, names, unresolved })
  }

  pub fn methods_of(&self, name: &str) -> BTreeSet<String> {
    let mut methods = BTreeSet::new();

    let Some(namespace) = self.namespace(name) else {
      return methods;
    };

    for (string_id, declaration_id) in namespace.members() {
      let Some(declaration) = self.graph.declarations().get(declaration_id) else {
        continue;
      };

      if declaration.as_method().is_none() {
        continue;
      }

      if let Some(method_name) = self.graph.strings().get(string_id) {
        methods.insert(method_name.trim_end_matches("()").to_string());
      }
    }

    methods
  }

  pub fn helper_modules(&self) -> Vec<String> {
    let mut modules: Vec<String> = self
      .graph
      .declarations()
      .values()
      .filter(|declaration| matches!(declaration.as_namespace(), Some(Namespace::Module(_))))
      .map(|declaration| declaration.name().to_string())
      .filter(|name| name.ends_with("Helper"))
      .collect();

    modules.sort();
    modules.dedup();

    modules
  }

  pub fn is_app_owned(&self, name: &str, path: &str) -> bool {
    let Some(declaration) = self.declaration(name) else {
      return false;
    };

    let uris: Vec<&str> = declaration
      .definitions()
      .iter()
      .filter_map(|definition_id| self.graph.definitions().get(definition_id))
      .filter_map(|definition| self.graph.documents().get(definition.uri_id()).map(|document| document.uri()))
      .collect();

    !uris.is_empty() && uris.iter().all(|uri| uri.contains(path))
  }

  pub fn methods_with_visibility(&self, name: &str) -> BTreeMap<String, String> {
    let mut methods = BTreeMap::new();

    let Some(namespace) = self.namespace(name) else {
      return methods;
    };

    for (string_id, declaration_id) in namespace.members() {
      let Some(declaration) = self.graph.declarations().get(declaration_id) else {
        continue;
      };

      if declaration.as_method().is_none() {
        continue;
      }

      let Some(method_name) = self.graph.strings().get(string_id) else {
        continue;
      };

      let visibility = self
        .graph
        .visibility(declaration_id)
        .map_or_else(|| "unknown".to_string(), |visibility| format!("{visibility:?}"));

      methods.insert(method_name.trim_end_matches("()").to_string(), visibility);
    }

    methods
  }

  pub fn methods_with_ancestors(&self, name: &str) -> BTreeMap<String, String> {
    let mut methods = BTreeMap::new();

    let Some(ancestry) = self.ancestors_of(name) else {
      return methods;
    };

    let mut chain = vec![name.to_string()];
    chain.extend(ancestry.names.iter().filter(|n| *n != "<unresolved>").cloned());

    for owner in chain {
      for method in self.methods_of(&owner) {
        methods.entry(method).or_insert_with(|| owner.clone());
      }
    }

    methods
  }

  pub fn view_visible_helpers(&self, roots: &[&str]) -> BTreeMap<String, String> {
    let mut helpers = BTreeMap::new();

    for root in roots {
      for (method, owner) in self.methods_with_ancestors(root) {
        helpers.entry(method).or_insert(owner);
      }
    }

    helpers
  }

  pub fn resolve_constant(&self, nesting: &[&str], name: &str) -> Option<String> {
    for depth in (0..=nesting.len()).rev() {
      let mut candidate = nesting[..depth].join("::");

      if !candidate.is_empty() {
        candidate.push_str("::");
      }

      candidate.push_str(name);

      if let Some(declaration) = self.declaration(&candidate) {
        return Some(declaration.name().to_string());
      }
    }

    None
  }

  pub fn update_document(&mut self, uri: &str, source: &str) {
    self.graph.delete_document(uri);
    indexing::index_source(&mut self.graph, uri, source, &LanguageId::Ruby);
  }

  pub fn remove_document(&mut self, uri: &str) {
    self.graph.delete_document(uri);
  }

  pub fn graph(&self) -> &Graph {
    &self.graph
  }

  pub fn files_indexed(&self) -> usize {
    self.files_indexed
  }

  pub fn declaration_count(&self) -> usize {
    self.graph.declarations().len()
  }

  pub fn definition_count(&self) -> usize {
    self.graph.definitions().len()
  }

  pub fn timings(&self) -> &[(&'static str, Duration)] {
    &self.timings
  }

  pub fn index_errors(&self) -> &[String] {
    &self.index_errors
  }
}
