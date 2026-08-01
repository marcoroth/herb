use std::collections::HashSet;
use herb_analysis::Analysis;

fn fixture_app() -> Analysis {
  let mut analysis = Analysis::index_paths(&["tests/fixtures/app".to_string()], &HashSet::new());
  analysis.resolve();

  analysis
}

fn flat_def_scan() -> HashSet<String> {
  ["format_price", "format_date", "page_title", "current_year", "internal_only_secret"]
    .iter()
    .map(|name| (*name).to_string())
    .collect()
}

#[test]
fn resolves_helpers_reaching_the_view_through_a_concern() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");

  assert_eq!(helpers.get("format_price").map(String::as_str), Some("FormattingHelper"));
  assert_eq!(helpers.get("format_date").map(String::as_str), Some("FormattingHelper"));

  assert_eq!(helpers.get("page_title").map(String::as_str), Some("ApplicationHelper"));
  assert_eq!(helpers.get("current_year").map(String::as_str), Some("ApplicationHelper"));
}

#[test]
fn attributes_each_helper_to_its_owning_module() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");

  assert_ne!(
    helpers.get("format_price"),
    helpers.get("page_title"),
    "helpers from different modules should not report the same owner"
  );
}

#[test]
fn documents_that_private_helpers_are_still_over_reported() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");

  assert!(
    helpers.contains_key("internal_only_secret"),
    "if this now fails, visibility filtering has been wired up — tighten this test"
  );
}

#[test]
fn does_not_resolve_typos_or_undefined_names() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");

  assert!(!helpers.contains_key("page_titel"));
  assert!(!helpers.contains_key("frmat_price"));
}

#[test]
fn confirms_route_helpers_remain_a_gap() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");

  assert!(!helpers.contains_key("users_path"));
  assert!(!helpers.contains_key("root_url"));
}

#[test]
fn compares_against_the_flat_def_scan() {
  let analysis = fixture_app();
  let helpers = analysis.methods_with_ancestors("ApplicationHelper");
  let flat = flat_def_scan();

  let resolved: HashSet<String> = helpers.keys().cloned().collect();

  for name in &flat {
    assert!(resolved.contains(name), "{name} was found by the flat scan but not by rubydex");
  }

  assert!(resolved.len() >= flat.len(), "rubydex should know at least as much as the flat scan");
}

#[test]
fn visibility_can_distinguish_private_helpers() {
  let analysis = fixture_app();
  let visibility = analysis.methods_with_visibility("ApplicationHelper");

  eprintln!("resolved visibility: {visibility:?}");

  assert_eq!(visibility.get("page_title").map(String::as_str), Some("Public"));
  assert_eq!(visibility.get("current_year").map(String::as_str), Some("Public"));
  assert_eq!(visibility.get("internal_only_secret").map(String::as_str), Some("Private"));
}

#[test]
fn discovers_helper_modules_by_convention() {
  let analysis = fixture_app();
  let modules = analysis.helper_modules();

  assert!(modules.contains(&"ApplicationHelper".to_string()));
  assert!(modules.contains(&"FormattingHelper".to_string()));
  assert!(modules.iter().all(|name| name.ends_with("Helper")));
}

#[test]
fn distinguishes_app_owned_modules_from_foreign_ones() {
  let analysis = fixture_app();

  assert!(analysis.is_app_owned("ApplicationHelper", "tests/fixtures/app"));
  assert!(!analysis.is_app_owned("ApplicationHelper", "some/other/path"));
  assert!(!analysis.is_app_owned("NoSuchHelper", "tests/fixtures/app"));
}
