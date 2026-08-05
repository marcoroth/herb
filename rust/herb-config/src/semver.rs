use std::cmp::Ordering;

pub const UNRELEASED_VERSION: &str = "unreleased";

pub fn parse_semver(version: &str) -> (i64, i64, i64) {
  let core = version.trim().split('+').next().unwrap_or_default().split('-').next().unwrap_or_default();
  let parts: Vec<&str> = core.split('.').collect();

  if parts.len() < 2 || parts.len() > 3 {
    return (0, 0, 0);
  }

  let major = parts[0].parse::<i64>();
  let minor = parts[1].parse::<i64>();
  let patch = if parts.len() == 3 { parts[2].parse::<i64>() } else { Ok(0) };

  match (major, minor, patch) {
    (Ok(major), Ok(minor), Ok(patch)) => (major, minor, patch),
    _ => (0, 0, 0),
  }
}

pub fn compare_semver(a: &str, b: &str) -> Ordering {
  match (a == UNRELEASED_VERSION, b == UNRELEASED_VERSION) {
    (true, true) => Ordering::Equal,
    (true, false) => Ordering::Greater,
    (false, true) => Ordering::Less,
    (false, false) => parse_semver(a).cmp(&parse_semver(b)),
  }
}

pub fn semver_greater_than(a: &str, b: &str) -> bool {
  compare_semver(a, b) == Ordering::Greater
}
