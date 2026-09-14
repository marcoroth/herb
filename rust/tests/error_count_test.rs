use herb::Node;

#[test]
fn error_count_is_exposed_and_short_circuits() {
  let clean = herb::parse("<div class=\"a\">hello</div>").unwrap();
  let dirty = herb::parse("<div><span>hello</div>").unwrap();

  assert_eq!(clean.error_count, Some(0));
  assert_eq!(clean.recursive_errors().len(), 0);
  assert_eq!(dirty.error_count, Some(1));
  assert_eq!(dirty.recursive_errors().len(), 1);
}

#[test]
fn error_count_matches_the_tree_across_error_paths() {
  for source in ["<div>", "<div><span>hello</div>", "<% if condition without end %>", "<% if x %>"] {
    let result = herb::parse(source).unwrap();

    assert_eq!(
      result.error_count,
      Some(result.value.recursive_errors().len() as u32),
      "count mismatch for {source:?}"
    );
  }
}
