use crate::rule::{AnyRule, Rule};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Fixability {
  pub autocorrectable: bool,
  pub unsafe_autocorrectable: bool,
}

pub fn fixability_for(rule: Option<&AnyRule>) -> Fixability {
  let rule = match rule {
    Some(rule) => rule,
    None => return Fixability::default(),
  };

  let correctable = rule.autocorrectable();
  let unsafe_correctable = rule.unsafe_autocorrectable();

  if !correctable && !unsafe_correctable {
    return Fixability::default();
  }

  Fixability {
    autocorrectable: correctable && !unsafe_correctable,
    unsafe_autocorrectable: unsafe_correctable,
  }
}
