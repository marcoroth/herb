use std::collections::HashSet;

use herb_analysis::Analysis;

fn fixture() -> Analysis {
  let mut analysis = Analysis::index_paths(&["tests/fixtures/ruby".to_string()], &HashSet::new());
  analysis.resolve();

  analysis
}

#[test]
fn lists_value_constants_with_their_fully_qualified_names() {
  let constants = fixture().constants();

  assert!(constants.contains_key("CONFIG"), "{constants:?}");
  assert!(constants.contains_key("Admin::CONFIG"));
  assert!(constants.contains_key("Billing::Invoice::CONFIG"));
  assert!(constants.contains_key("Status::ACTIVE"));
}

#[test]
fn does_not_list_classes_and_modules() {
  let constants = fixture().constants();

  assert!(!constants.contains_key("Admin"));
  assert!(!constants.contains_key("Admin::UsersController"));
}

#[test]
fn resolution_still_works_alongside_listing() {
  let analysis = fixture();

  assert_eq!(
    analysis.resolve_constant(&["Admin", "UsersController"], "CONFIG"),
    Some("Admin::CONFIG".to_string())
  );
}
