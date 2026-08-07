use std::collections::HashMap;

use crate::action_view_partial_index::StrictLocal;

#[derive(Clone, Debug)]
pub struct PartialCallSite {
  pub caller: String,
  pub locals: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct InferredSignature {
  pub locals: Vec<StrictLocal>,
  pub call_site_count: usize,
  pub keyword_rest: bool,
}

#[derive(Clone, Debug, Default)]
pub struct PartialCallerIndex {
  pub unresolved_renders: usize,
  pub skipped_files: usize,
  call_sites: HashMap<String, Vec<PartialCallSite>>,
}

impl PartialCallerIndex {
  pub fn new(call_sites: HashMap<String, Vec<PartialCallSite>>, unresolved_renders: usize, skipped_files: usize) -> Self {
    Self {
      call_sites,
      unresolved_renders,
      skipped_files,
    }
  }

  pub fn is_complete(&self) -> bool {
    self.unresolved_renders == 0 && self.skipped_files == 0
  }

  pub fn callers_of(&self, partial_file: &str) -> &[PartialCallSite] {
    match self.call_sites.get(partial_file) {
      Some(call_sites) => call_sites,
      None => &[],
    }
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
      locals: names.into_iter().map(|name| StrictLocal { name, required: false }).collect(),
      call_site_count: callers.len(),
      keyword_rest: !self.is_complete(),
    }
  }

  pub fn len(&self) -> usize {
    self.call_sites.len()
  }

  pub fn is_empty(&self) -> bool {
    self.call_sites.is_empty()
  }
}

pub fn strict_locals_declaration(signature: &InferredSignature) -> String {
  let mut parameters: Vec<String> = signature
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

  if signature.keyword_rest {
    parameters.push("**".to_string());
  }

  format!("<%# locals: ({}) %>", parameters.join(", "))
}
