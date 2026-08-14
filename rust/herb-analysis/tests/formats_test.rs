use std::fs;
use std::path::PathBuf;

use herb_analysis::partial_index::PartialIndex;
use herb_analysis::partial_resolution::{format_of, variant_of};

fn scratch(name: &str) -> PathBuf {
  let root = std::env::temp_dir().join(format!("herb-formats-{name}"));

  let _ = fs::remove_dir_all(&root);

  root
}

fn write(path: &PathBuf) -> String {
  fs::create_dir_all(path.parent().unwrap()).unwrap();
  fs::write(path, "<div></div>\n").unwrap();

  path.to_str().unwrap().to_string()
}

#[test]
fn reads_the_format_out_of_a_filename() {
  assert_eq!(Some("html".to_string()), format_of("app/views/posts/_row.html.erb"));
  assert_eq!(Some("turbo_stream".to_string()), format_of("app/views/posts/_row.turbo_stream.erb"));
  assert_eq!(Some("html".to_string()), format_of("app/views/posts/_row.html.herb"));
  assert_eq!(None, format_of("app/views/posts/_row.erb"));
  assert_eq!(None, format_of("app/views/posts/_row.herb"));
}

#[test]
fn a_caller_reaches_the_partial_matching_its_own_format() {
  let root = scratch("matching");
  let views = root.join("app/views");

  let html_caller = write(&views.join("posts/index.html.erb"));
  let turbo_caller = write(&views.join("posts/index.turbo_stream.erb"));
  let html_partial = write(&views.join("posts/_row.html.erb"));
  let turbo_partial = write(&views.join("posts/_row.turbo_stream.erb"));

  let index = PartialIndex::new(
    &[views],
    vec![html_caller.clone(), turbo_caller.clone(), html_partial.clone(), turbo_partial.clone()],
  );

  assert_eq!(html_partial, index.resolve("posts/row", Some(&html_caller))[0]);
  assert_eq!(turbo_partial, index.resolve("posts/row", Some(&turbo_caller))[0]);
}

#[test]
fn a_formatless_partial_serves_any_caller() {
  let root = scratch("formatless");
  let views = root.join("app/views");

  let turbo_caller = write(&views.join("posts/index.turbo_stream.erb"));
  let partial = write(&views.join("posts/_row.erb"));

  let index = PartialIndex::new(&[views], vec![turbo_caller.clone(), partial.clone()]);

  assert_eq!(partial, index.resolve("posts/row", Some(&turbo_caller))[0]);
}

#[test]
fn a_formatless_partial_loses_to_an_exact_format_match() {
  let root = scratch("exact-wins");
  let views = root.join("app/views");

  let turbo_caller = write(&views.join("posts/index.turbo_stream.erb"));
  let formatless = write(&views.join("posts/_row.erb"));
  let turbo_partial = write(&views.join("posts/_row.turbo_stream.erb"));

  let index = PartialIndex::new(&[views], vec![turbo_caller.clone(), formatless, turbo_partial.clone()]);

  assert_eq!(turbo_partial, index.resolve("posts/row", Some(&turbo_caller))[0]);
}

#[test]
fn extension_precedence_still_decides_when_no_format_matches() {
  let root = scratch("fallback");
  let views = root.join("app/views");

  let turbo_caller = write(&views.join("posts/index.turbo_stream.erb"));
  let html_partial = write(&views.join("posts/_row.html.erb"));

  let index = PartialIndex::new(&[views], vec![turbo_caller.clone(), html_partial.clone()]);

  assert_eq!(html_partial, index.resolve("posts/row", Some(&turbo_caller))[0]);
}

#[test]
fn reads_the_variant_out_of_a_filename() {
  assert_eq!(Some("mobile".to_string()), variant_of("app/views/posts/_row.html+mobile.erb"));
  assert_eq!(Some("tablet".to_string()), variant_of("app/views/posts/_row.html+tablet.herb"));
  assert_eq!(None, variant_of("app/views/posts/_row.html.erb"));
  assert_eq!(None, variant_of("app/views/posts/_row.erb"));
}

#[test]
fn a_variant_keeps_the_format_of_its_base_template() {
  assert_eq!(Some("html".to_string()), format_of("app/views/posts/_row.html+mobile.erb"));
  assert_eq!(Some("turbo_stream".to_string()), format_of("app/views/posts/_row.turbo_stream+mobile.erb"));
}

#[test]
fn the_plain_template_is_preferred_over_a_variant() {
  let root = scratch("variant");
  let views = root.join("app/views");

  let caller = write(&views.join("posts/index.html.erb"));
  let variant = write(&views.join("posts/_row.html+mobile.erb"));
  let plain = write(&views.join("posts/_row.html.erb"));

  let index = PartialIndex::new(&[views], vec![caller.clone(), variant.clone(), plain.clone()]);
  let resolved = index.resolve("posts/row", Some(&caller));

  assert_eq!(plain, resolved[0]);
  assert!(resolved.contains(&variant), "the variant is still reachable: {resolved:?}");
}
