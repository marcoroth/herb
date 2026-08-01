use herb_config::deep_merge;

fn yaml(source: &str) -> serde_yaml::Value {
  serde_yaml::from_str(source).unwrap()
}

fn merged(target: &str, source: &str) -> serde_yaml::Value {
  deep_merge(&yaml(target), &yaml(source))
}

#[test]
fn merges_simple_objects() {
  assert_eq!(merged("a: 1\nb: 2\n", "b: 3\nc: 4\n"), yaml("a: 1\nb: 3\nc: 4\n"));
}

#[test]
fn merges_nested_objects() {
  assert_eq!(
    merged("a:\n  x: 1\n  y: 2\nb: 3\n", "a:\n  y: 20\n  z: 30\n"),
    yaml("a:\n  x: 1\n  y: 20\n  z: 30\nb: 3\n")
  );
}

#[test]
fn does_not_mutate_the_target() {
  let target = yaml("a: 1\nb:\n  c: 2\n");
  let result = deep_merge(&target, &yaml("b:\n  c: 3\n"));

  assert_eq!(target["b"]["c"], yaml("2"));
  assert_eq!(result["b"]["c"], yaml("3"));
}

#[test]
fn replaces_arrays_that_are_not_include_or_exclude() {
  assert_eq!(merged("arr:\n  - 1\n  - 2\n  - 3\n", "arr:\n  - 4\n  - 5\n")["arr"], yaml("[4, 5]"));
}

#[test]
fn concatenates_include_and_exclude_arrays() {
  let result = merged("include:\n  - a\nexclude:\n  - x\n", "include:\n  - b\nexclude:\n  - y\n");

  assert_eq!(result["include"], yaml("[a, b]"));
  assert_eq!(result["exclude"], yaml("[x, y]"));
}

#[test]
fn keys_absent_from_the_source_are_kept() {
  assert_eq!(merged("a: 1\nb: 2\n", "b: 3\n"), yaml("a: 1\nb: 3\n"));
}

#[test]
fn handles_null_values() {
  let result = merged("a: 1\n", "a: ~\n");

  assert!(result["a"].is_null());
}

#[test]
fn merges_deeply_nested_objects() {
  assert_eq!(
    merged("a:\n  b:\n    c:\n      d: 1\n", "a:\n  b:\n    c:\n      e: 2\n"),
    yaml("a:\n  b:\n    c:\n      d: 1\n      e: 2\n")
  );
}

#[test]
fn handles_an_empty_source() {
  assert_eq!(merged("a: 1\nb:\n  c: 2\n", "{}"), yaml("a: 1\nb:\n  c: 2\n"));
}

#[test]
fn handles_an_empty_target() {
  assert_eq!(merged("{}", "a: 1\nb:\n  c: 2\n"), yaml("a: 1\nb:\n  c: 2\n"));
}

#[test]
fn overwrites_primitives_with_objects() {
  assert_eq!(merged("a: 1\n", "a:\n  b: 2\n"), yaml("a:\n  b: 2\n"));
}

#[test]
fn overwrites_objects_with_primitives() {
  assert_eq!(merged("a:\n  b: 2\n", "a: 1\n"), yaml("a: 1\n"));
}

#[test]
fn returns_the_source_when_the_target_is_not_a_mapping() {
  assert_eq!(deep_merge(&yaml("5"), &yaml("a: 1\n")), yaml("a: 1\n"));
}
