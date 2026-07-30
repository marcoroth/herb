use std::cmp::Ordering;

pub const UNRELEASED_VERSION: &str = "unreleased";

pub fn parse_semver(version: &str) -> (u32, u32, u32) {
  let parts: Vec<&str> = version.split('.').collect();

  if parts.len() < 2 || parts.len() > 3 {
    return (0, 0, 0);
  }

  let major = parts[0].parse::<u32>();
  let minor = parts[1].parse::<u32>();
  let patch = parts.get(2).map_or(Ok(0), |part| part.parse::<u32>());

  match (major, minor, patch) {
    (Ok(major), Ok(minor), Ok(patch)) => (major, minor, patch),
    _ => (0, 0, 0),
  }
}

pub fn compare_semver(a: &str, b: &str) -> Ordering {
  if a == UNRELEASED_VERSION && b == UNRELEASED_VERSION {
    return Ordering::Equal;
  }

  if a == UNRELEASED_VERSION {
    return Ordering::Greater;
  }

  if b == UNRELEASED_VERSION {
    return Ordering::Less;
  }

  let (major_a, minor_a, patch_a) = parse_semver(a);
  let (major_b, minor_b, patch_b) = parse_semver(b);

  if major_a != major_b {
    return major_a.cmp(&major_b);
  }

  if minor_a != minor_b {
    return minor_a.cmp(&minor_b);
  }

  patch_a.cmp(&patch_b)
}

pub fn semver_greater_than(a: &str, b: &str) -> bool {
  compare_semver(a, b) == Ordering::Greater
}
