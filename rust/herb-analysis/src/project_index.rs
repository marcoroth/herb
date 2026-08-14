use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::partial_index::PartialIndex;
use crate::partial_resolution::{partial_path, template_path};
use crate::render_graph::RenderGraph;
use crate::render_graph_builder::Builder;

pub struct ProjectIndex {
  project_path: PathBuf,
  partials: Option<PartialIndex>,
  graph: Option<RenderGraph>,
  resolve_layouts: bool,
}

impl ProjectIndex {
  pub fn new(project_path: &Path) -> Self {
    Self {
      project_path: project_path.to_path_buf(),
      partials: None,
      graph: None,
      resolve_layouts: true,
    }
  }

  pub fn with_layouts(project_path: &Path, resolve_layouts: bool) -> Self {
    Self {
      project_path: project_path.to_path_buf(),
      partials: None,
      graph: None,
      resolve_layouts,
    }
  }

  pub fn index_all(&mut self) {
    self.index_partials();
    self.index_call_sites();
  }

  pub fn index_partials(&mut self) {
    self.partials = Some(PartialIndex::build(&self.project_path));
  }

  pub fn index_call_sites(&mut self) {
    let Some(partials) = self.partials.as_mut() else {
      self.graph = None;

      return;
    };

    let templates = partials.templates().to_vec();

    self.graph = Some(Builder::with_layouts(partials, self.resolve_layouts).build(&templates));
  }

  pub fn partials(&self) -> Option<&PartialIndex> {
    self.partials.as_ref()
  }

  pub fn partials_mut(&mut self) -> Option<&mut PartialIndex> {
    self.partials.as_mut()
  }

  pub fn graph(&self) -> Option<&RenderGraph> {
    self.graph.as_ref()
  }

  pub fn view_roots(&self) -> Option<&[PathBuf]> {
    self.partials.as_ref().map(|partials| partials.view_roots())
  }

  pub fn handle_change(&mut self, path: &str, source: Option<&str>) -> bool {
    let Some(file) = self.template_file_for(path) else {
      return false;
    };

    let declaration_changed = self.update_partial(&file);
    let calls_changed = self.update_call_sites(&file, source);

    declaration_changed || calls_changed
  }

  pub fn remove(&mut self, path: &str) -> bool {
    let Some(file) = self.template_file_for(path) else {
      return false;
    };

    let stopped_calling = self.remove_call_sites(&file);
    let removed_partial = self.remove_partial(&file);

    removed_partial || stopped_calling
  }

  fn template_file_for(&self, path: &str) -> Option<String> {
    if !template_path(path) {
      return None;
    }

    let candidate = Path::new(path);
    let full = if candidate.is_absolute() {
      candidate.to_path_buf()
    } else {
      self.project_path.join(candidate)
    };

    Some(full.to_str()?.to_string())
  }

  fn update_partial(&mut self, file: &str) -> bool {
    if !partial_path(file) {
      return false;
    }

    match self.partials.as_mut() {
      Some(partials) => partials.update(file).is_some(),
      None => false,
    }
  }

  fn remove_partial(&mut self, file: &str) -> bool {
    if !partial_path(file) {
      return false;
    }

    match self.partials.as_mut() {
      Some(partials) => partials.remove(file).is_some(),
      None => false,
    }
  }

  fn update_call_sites(&mut self, file: &str, source: Option<&str>) -> bool {
    let contents = match source {
      Some(text) => text.to_string(),
      None => match fs::read_to_string(file) {
        Ok(text) => text,
        Err(_) => return false,
      },
    };

    let (Some(partials), Some(graph)) = (self.partials.as_mut(), self.graph.as_mut()) else {
      return false;
    };

    let mut sites = BTreeMap::new();
    let collected = Builder::with_layouts(partials, self.resolve_layouts).collect_call_sites(file, &contents, &mut sites);

    let changed = graph.replace_calls_from(file, sites, collected.unresolved);
    graph.set_roots(file, collected.roots);

    if collected.document_root {
      graph.add_document_root(file);
    }

    changed
  }

  fn remove_call_sites(&mut self, file: &str) -> bool {
    let Some(graph) = self.graph.as_mut() else {
      return false;
    };

    let stopped_calling = graph.replace_calls_from(file, BTreeMap::new(), 0);

    graph.remove_calls_to(file) || stopped_calling
  }
}
