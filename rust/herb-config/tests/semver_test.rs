use std::cmp::Ordering;

use herb_config::{compare_semver, parse_semver, semver_greater_than, UNRELEASED_VERSION};

#[test]
fn parses_major_minor_patch() {
  assert_eq!(parse_semver("1.2.3"), (1, 2, 3));
}

#[test]
fn parses_major_minor_without_patch() {
  assert_eq!(parse_semver("1.2"), (1, 2, 0));
}

#[test]
fn parses_large_version_numbers() {
  assert_eq!(parse_semver("10.20.30"), (10, 20, 30));
}

#[test]
fn returns_zeros_for_invalid_versions() {
  assert_eq!(parse_semver("invalid"), (0, 0, 0));
  assert_eq!(parse_semver(""), (0, 0, 0));
  assert_eq!(parse_semver("1.2.3.4"), (0, 0, 0));
  assert_eq!(parse_semver("a.b.c"), (0, 0, 0));
}

#[test]
fn ignores_pre_release_suffixes() {
  assert_eq!(parse_semver("0.11.0-beta.1"), (0, 11, 0));
  assert_eq!(parse_semver("1.0.0-rc.2"), (1, 0, 0));
}

#[test]
fn ignores_build_metadata() {
  assert_eq!(parse_semver("0.11.0+20260801"), (0, 11, 0));
}

#[test]
fn ignores_surrounding_whitespace() {
  assert_eq!(parse_semver(" 0.10.3 "), (0, 10, 3));
}

#[test]
fn compares_components_numerically_instead_of_as_strings() {
  assert_eq!(compare_semver("0.10.3", "0.9.2"), Ordering::Greater);
  assert_eq!(compare_semver("0.9.2", "0.10.3"), Ordering::Less);
}

#[test]
fn compares_each_component_in_order() {
  assert_eq!(compare_semver("2.0.0", "1.99.99"), Ordering::Greater);
  assert_eq!(compare_semver("1.2.0", "1.1.0"), Ordering::Greater);
  assert_eq!(compare_semver("1.2.4", "1.2.3"), Ordering::Greater);
  assert_eq!(compare_semver("1.2.3", "1.2.3"), Ordering::Equal);
}

#[test]
fn treats_a_missing_patch_as_zero() {
  assert_eq!(compare_semver("0.10", "0.10.0"), Ordering::Equal);
  assert_eq!(compare_semver("0.10.1", "0.10"), Ordering::Greater);
}

#[test]
fn treats_a_pre_release_as_its_released_version() {
  assert_eq!(compare_semver("0.11.0-beta.1", "0.11.0"), Ordering::Equal);
  assert_eq!(compare_semver("0.11.0-beta.1", "0.10.3"), Ordering::Greater);
}

#[test]
fn sorts_an_unparseable_version_before_every_real_one() {
  assert_eq!(compare_semver("next", "0.10.3"), Ordering::Less);
  assert_eq!(compare_semver("0.10.3", "next"), Ordering::Greater);
}

#[test]
fn unreleased_is_newer_than_every_released_version() {
  assert_eq!(compare_semver(UNRELEASED_VERSION, "99.99.99"), Ordering::Greater);
  assert_eq!(compare_semver("99.99.99", UNRELEASED_VERSION), Ordering::Less);
  assert_eq!(compare_semver(UNRELEASED_VERSION, UNRELEASED_VERSION), Ordering::Equal);
}

#[test]
fn semver_greater_than_is_true_only_when_the_first_version_is_newer() {
  assert!(semver_greater_than("0.10.3", "0.9.2"));
  assert!(!semver_greater_than("0.9.2", "0.10.3"));
  assert!(!semver_greater_than("0.10.3", "0.10.3"));
  assert!(semver_greater_than(UNRELEASED_VERSION, "99.99.99"));
  assert!(!semver_greater_than("99.99.99", UNRELEASED_VERSION));
}
