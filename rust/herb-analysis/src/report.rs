use std::collections::{BTreeMap, BTreeSet};

use herb::action_view_helpers;

pub fn expected(gem: Option<&str>, public_only: bool) -> BTreeSet<String> {
  action_view_helpers::entries()
    .iter()
    .filter(|entry| gem.is_none_or(|gem| entry.gem == gem))
    .filter(|entry| !public_only || entry.visibility == "public")
    .map(|entry| entry.name.to_string())
    .collect()
}

pub struct Diff {
  pub matched: BTreeSet<String>,
  pub missing: BTreeSet<String>,
  pub extra: BTreeMap<String, String>,
}

impl Diff {
  pub fn new(found: &BTreeMap<String, String>, oracle: &BTreeSet<String>) -> Self {
    let mut matched = BTreeSet::new();
    let mut missing = BTreeSet::new();
    let mut extra = BTreeMap::new();

    for name in oracle {
      if found.contains_key(name) {
        matched.insert(name.clone());
      } else {
        missing.insert(name.clone());
      }
    }

    for (name, owner) in found {
      if !oracle.contains(name) {
        extra.insert(name.clone(), owner.clone());
      }
    }

    Self { matched, missing, extra }
  }

  pub fn recall(&self) -> f64 {
    let total = self.matched.len() + self.missing.len();

    if total == 0 {
      return 0.0;
    }

    self.matched.len() as f64 / total as f64
  }
}
