use std::collections::{BTreeMap, BTreeSet};

use crate::partial_declaration::StrictLocal;

pub const MAX_ANCESTOR_CHAINS: usize = 32;

pub type StaticAttributeMap = BTreeMap<String, String>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
  Always,
  Never,
  Mixed,
  Unknown,
}

impl Verdict {
  pub fn as_str(&self) -> &'static str {
    match self {
      Verdict::Always => "always",
      Verdict::Never => "never",
      Verdict::Mixed => "mixed",
      Verdict::Unknown => "unknown",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CallSiteLocation {
  pub line: usize,
  pub column: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartialCallSite {
  pub caller: String,
  pub locals: Vec<String>,
  pub ancestors: Vec<String>,
  pub ancestor_attributes: Option<Vec<StaticAttributeMap>>,
  pub via: String,
  pub location: Option<CallSiteLocation>,
}

impl PartialCallSite {
  pub fn render(caller: &str, locals: Vec<String>, ancestors: Vec<String>) -> Self {
    Self {
      caller: caller.to_string(),
      locals,
      ancestors,
      ancestor_attributes: None,
      via: "render".to_string(),
      location: None,
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallFrame {
  pub file: String,
  pub ancestors: Vec<String>,
  pub ancestor_attributes: Option<Vec<StaticAttributeMap>>,
  pub via: String,
  pub location: Option<CallSiteLocation>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateRoots {
  pub tags: Vec<String>,
  pub conditional_tags: Vec<String>,
  pub renders: Vec<String>,
  pub resolved: bool,
}

impl Default for TemplateRoots {
  fn default() -> Self {
    Self {
      tags: Vec::new(),
      conditional_tags: Vec::new(),
      renders: Vec::new(),
      resolved: true,
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InferredSignature {
  pub locals: Vec<StrictLocal>,
  pub call_site_count: usize,
  pub keyword_rest: bool,
}

impl InferredSignature {
  pub fn strict_locals_declaration(&self) -> String {
    let mut parameters: Vec<String> = self
      .locals
      .iter()
      .map(|local| {
        if local.required {
          format!("{}:", local.name)
        } else {
          format!("{}: nil", local.name)
        }
      })
      .collect();

    if self.keyword_rest {
      parameters.push("**".to_string());
    }

    format!("<%# locals: ({}) %>", parameters.join(", "))
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AncestorChain {
  pub tags: Vec<String>,
  pub attributes: Option<Vec<StaticAttributeMap>>,
  pub frames: Vec<CallFrame>,
  pub occurrences: usize,
}

impl AncestorChain {
  pub fn empty() -> Self {
    Self {
      tags: Vec::new(),
      attributes: None,
      frames: Vec::new(),
      occurrences: 1,
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartialContext {
  pub chains: Vec<AncestorChain>,
  pub resolved: bool,
}

impl PartialContext {
  pub fn unresolved() -> Self {
    Self {
      chains: Vec::new(),
      resolved: false,
    }
  }

  pub fn document_root() -> Self {
    Self {
      chains: vec![AncestorChain::empty()],
      resolved: true,
    }
  }

  pub fn ancestor_verdict(&self, local_ancestors: &[String], tag_names: &[&str]) -> Verdict {
    if local_ancestors.iter().any(|tag| tag_names.contains(&tag.as_str())) {
      return Verdict::Always;
    }

    if self.chains.is_empty() {
      return Verdict::Unknown;
    }

    let matches = self
      .chains
      .iter()
      .filter(|chain| chain.tags.iter().any(|tag| tag_names.contains(&tag.as_str())))
      .count();

    if matches == self.chains.len() {
      return Verdict::Always;
    }

    if matches > 0 {
      return Verdict::Mixed;
    }

    if self.resolved {
      Verdict::Never
    } else {
      Verdict::Unknown
    }
  }

  pub fn closest_ancestor(&self, local_ancestors: &[String], tag_names: &[&str]) -> Option<String> {
    if let Some(local) = innermost(local_ancestors, tag_names) {
      return Some(local);
    }

    self.chains.iter().find_map(|chain| innermost(&chain.tags, tag_names))
  }
}

fn innermost(chain: &[String], tag_names: &[&str]) -> Option<String> {
  chain.iter().rev().find(|tag| tag_names.contains(&tag.as_str())).cloned()
}

#[derive(Default)]
pub struct RenderGraph {
  call_sites: BTreeMap<String, Vec<PartialCallSite>>,
  roots: BTreeMap<String, TemplateRoots>,
  document_roots: BTreeSet<String>,
  unresolved_renders: BTreeMap<String, usize>,
  skipped_files: BTreeSet<String>,
}

impl RenderGraph {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn unresolved_render_count(&self) -> usize {
    self.unresolved_renders.values().sum()
  }

  pub fn skipped_file_count(&self) -> usize {
    self.skipped_files.len()
  }

  pub fn is_complete(&self) -> bool {
    self.unresolved_renders.is_empty() && self.skipped_files.is_empty()
  }

  pub fn size(&self) -> usize {
    self.call_sites.len()
  }

  pub fn roots_of(&self, file: &str) -> TemplateRoots {
    self.roots.get(file).cloned().unwrap_or_default()
  }

  pub fn set_roots(&mut self, file: &str, roots: TemplateRoots) {
    self.roots.insert(file.to_string(), roots);
  }

  pub fn callers_of(&self, partial_file: &str) -> &[PartialCallSite] {
    self.call_sites.get(partial_file).map(|sites| sites.as_slice()).unwrap_or(&[])
  }

  pub fn add_document_root(&mut self, file: &str) {
    self.document_roots.insert(file.to_string());
  }

  pub fn is_document_root(&self, file: &str) -> bool {
    self.document_roots.contains(file)
  }

  pub fn skip(&mut self, file: &str) {
    self.skipped_files.insert(file.to_string());
  }

  pub fn replace_calls_from(&mut self, caller: &str, sites: BTreeMap<String, Vec<PartialCallSite>>, unresolved: usize) -> bool {
    let mut changed = self.replace_unresolved_from(caller, unresolved);

    let files: Vec<String> = self.call_sites.keys().cloned().collect();

    for partial_file in files {
      let Some(existing) = self.call_sites.get_mut(&partial_file) else {
        continue;
      };

      let before = existing.len();
      existing.retain(|call_site| call_site.caller != caller);

      if existing.len() == before {
        continue;
      }

      changed = true;

      if existing.is_empty() {
        self.call_sites.remove(&partial_file);
      }
    }

    for (partial_file, call_sites) in sites {
      if call_sites.is_empty() {
        continue;
      }

      changed = true;
      self.call_sites.entry(partial_file).or_default().extend(call_sites);
    }

    changed
  }

  fn replace_unresolved_from(&mut self, caller: &str, unresolved: usize) -> bool {
    let previous = self.unresolved_renders.get(caller).copied().unwrap_or(0);

    if previous == unresolved {
      return false;
    }

    if unresolved == 0 {
      self.unresolved_renders.remove(caller);
    } else {
      self.unresolved_renders.insert(caller.to_string(), unresolved);
    }

    true
  }

  pub fn remove_calls_to(&mut self, partial_file: &str) -> bool {
    self.call_sites.remove(partial_file).is_some()
  }

  pub fn infer_signature(&self, partial_file: &str) -> InferredSignature {
    let callers = self.callers_of(partial_file);
    let mut names: Vec<String> = Vec::new();

    for call_site in callers {
      for local in &call_site.locals {
        if !names.contains(local) {
          names.push(local.clone());
        }
      }
    }

    names.sort();

    InferredSignature {
      locals: names
        .into_iter()
        .map(|name| StrictLocal {
          name,
          required: false,
          default_source: None,
        })
        .collect(),
      call_site_count: callers.len(),
      keyword_rest: !self.is_complete(),
    }
  }

  pub fn context_of(&self, file: &str) -> PartialContext {
    self.resolve_context(file, &mut BTreeSet::new())
  }

  fn resolve_context(&self, file: &str, visiting: &mut BTreeSet<String>) -> PartialContext {
    if self.document_roots.contains(file) {
      return PartialContext::document_root();
    }

    if visiting.contains(file) {
      return PartialContext::unresolved();
    }

    let call_sites = self.callers_of(file);

    if call_sites.is_empty() {
      return PartialContext::unresolved();
    }

    visiting.insert(file.to_string());

    let mut chains: Vec<AncestorChain> = Vec::new();
    let mut by_key: BTreeMap<String, usize> = BTreeMap::new();
    let mut resolved = true;

    for call_site in call_sites {
      let parent = self.resolve_context(&call_site.caller, visiting);

      if !parent.resolved {
        resolved = false;
      }

      let frame = frame_for(call_site);
      let empty_chain = AncestorChain::empty();
      let prefixes: Vec<&AncestorChain> = if parent.chains.is_empty() {
        vec![&empty_chain]
      } else {
        parent.chains.iter().collect()
      };

      for prefix in prefixes {
        let mut tags = prefix.tags.clone();
        tags.extend(call_site.ancestors.clone());

        let mut attributes = prefix
          .attributes
          .clone()
          .unwrap_or_else(|| prefix.tags.iter().map(|_| StaticAttributeMap::new()).collect());
        attributes.extend(
          call_site
            .ancestor_attributes
            .clone()
            .unwrap_or_else(|| call_site.ancestors.iter().map(|_| StaticAttributeMap::new()).collect()),
        );

        let key = format!("{:?}|{:?}", tags, attributes);

        if let Some(index) = by_key.get(&key) {
          chains[*index].occurrences += prefix.occurrences;

          continue;
        }

        if chains.len() >= MAX_ANCESTOR_CHAINS {
          resolved = false;

          break;
        }

        let mut frames = prefix.frames.clone();
        frames.push(frame.clone());

        let has_attributes = attributes.iter().any(|attribute| !attribute.is_empty());

        by_key.insert(key, chains.len());
        chains.push(AncestorChain {
          tags,
          attributes: if has_attributes { Some(attributes) } else { None },
          frames,
          occurrences: prefix.occurrences,
        });
      }
    }

    visiting.remove(file);

    PartialContext { chains, resolved }
  }

  pub fn descendant_verdict(&self, files: &[String], tag_names: &[&str]) -> Verdict {
    if files.is_empty() {
      return Verdict::Unknown;
    }

    let verdicts: Vec<Verdict> = files.iter().map(|file| self.root_verdict(file, tag_names, &mut BTreeSet::new())).collect();

    if verdicts.iter().all(|verdict| *verdict == Verdict::Always) {
      return Verdict::Always;
    }

    if verdicts.iter().all(|verdict| *verdict == Verdict::Never) {
      return Verdict::Never;
    }

    if verdicts.iter().any(|verdict| *verdict == Verdict::Always || *verdict == Verdict::Mixed) {
      return Verdict::Mixed;
    }

    Verdict::Unknown
  }

  fn root_verdict(&self, file: &str, tag_names: &[&str], seen: &mut BTreeSet<String>) -> Verdict {
    if seen.contains(file) {
      return Verdict::Never;
    }

    seen.insert(file.to_string());

    let roots = self.roots_of(file);

    if roots.tags.iter().any(|tag| tag_names.contains(&tag.as_str())) {
      return Verdict::Always;
    }

    if roots.conditional_tags.iter().any(|tag| tag_names.contains(&tag.as_str())) {
      return Verdict::Mixed;
    }

    let through: Vec<Verdict> = roots
      .renders
      .iter()
      .map(|rendered| self.root_verdict(rendered, tag_names, &mut seen.clone()))
      .collect();

    if through.contains(&Verdict::Always) {
      return Verdict::Always;
    }

    if through.contains(&Verdict::Mixed) {
      return Verdict::Mixed;
    }

    if !roots.resolved || through.contains(&Verdict::Unknown) {
      return Verdict::Unknown;
    }

    Verdict::Never
  }
}

fn frame_for(call_site: &PartialCallSite) -> CallFrame {
  CallFrame {
    file: call_site.caller.clone(),
    ancestors: call_site.ancestors.clone(),
    ancestor_attributes: call_site.ancestor_attributes.clone(),
    via: call_site.via.clone(),
    location: call_site.location,
  }
}
