use crate::offense::Offense;
use crate::rule::{AnyRule, Rule};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Fixability {
  pub autocorrectable: bool,
  pub unsafe_autocorrectable: bool,
}

/// A rule can declare every one of its offenses unsafe to fix, and an offense
/// can declare itself unsafe even when the rule is generally safe, so both are
/// consulted before an offense counts as safely correctable.
pub fn fixability_for(offense: &Offense, rule: Option<&AnyRule>) -> Fixability {
  let rule = match rule {
    Some(rule) => rule,
    None => return Fixability::default(),
  };

  let correctable = rule.autocorrectable();
  let unsafe_correctable = rule.unsafe_autocorrectable() || offense.unsafe_fix;

  if !correctable && !unsafe_correctable {
    return Fixability::default();
  }

  Fixability {
    autocorrectable: correctable && !unsafe_correctable,
    unsafe_autocorrectable: unsafe_correctable,
  }
}
