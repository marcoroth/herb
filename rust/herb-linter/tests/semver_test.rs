use herb_linter::semver::{parse_semver, semver_greater_than, UNRELEASED_VERSION};

#[test]
fn parses_two_and_three_part_versions() {
  assert_eq!(parse_semver("1.2.3"), (1, 2, 3));
  assert_eq!(parse_semver("1.2"), (1, 2, 0));
}

#[test]
fn returns_zeroes_for_unparseable_versions() {
  assert_eq!(parse_semver("nope"), (0, 0, 0));
  assert_eq!(parse_semver("1.2.3.4"), (0, 0, 0));
}

#[test]
fn orders_unreleased_above_every_release() {
  assert!(semver_greater_than(UNRELEASED_VERSION, "9.9.9"));
  assert!(!semver_greater_than("9.9.9", UNRELEASED_VERSION));
  assert!(!semver_greater_than(UNRELEASED_VERSION, UNRELEASED_VERSION));
}

#[test]
fn compares_by_major_then_minor_then_patch() {
  assert!(semver_greater_than("1.0.0", "0.9.9"));
  assert!(semver_greater_than("0.10.0", "0.9.3"));
  assert!(semver_greater_than("0.9.4", "0.9.3"));
  assert!(!semver_greater_than("0.9.3", "0.9.3"));
}
