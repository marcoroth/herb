use std::fs;
use std::path::PathBuf;

use herb_analysis::partial_index::PartialIndex;

fn scratch(name: &str) -> PathBuf {
  let root = std::env::temp_dir().join(format!("herb-view-roots-{name}"));

  let _ = fs::remove_dir_all(&root);

  root
}

fn write(path: &PathBuf, body: &str) {
  fs::create_dir_all(path.parent().unwrap()).unwrap();
  fs::write(path, body).unwrap();
}

#[test]
fn names_a_partial_from_a_secondary_view_root() {
  let root = scratch("secondary");
  let app = root.join("app/views");
  let engine = root.join("engines/billing/app/views");

  write(&app.join("home/index.html.erb"), "<div></div>\n");
  write(&engine.join("billing/_invoice.html.erb"), "<div></div>\n");

  let templates = vec![
    app.join("home/index.html.erb").to_str().unwrap().to_string(),
    engine.join("billing/_invoice.html.erb").to_str().unwrap().to_string(),
  ];

  let index = PartialIndex::with_view_roots(&[app.clone(), engine.clone()], templates);

  assert_eq!(vec!["billing/invoice"], index.names());
}

#[test]
fn an_earlier_view_root_shadows_a_later_one() {
  let root = scratch("shadow");
  let app = root.join("app/views");
  let engine = root.join("engines/billing/app/views");

  write(&app.join("billing/_invoice.html.erb"), "<div>app</div>\n");
  write(&engine.join("billing/_invoice.html.erb"), "<div>engine</div>\n");

  let templates = vec![
    engine.join("billing/_invoice.html.erb").to_str().unwrap().to_string(),
    app.join("billing/_invoice.html.erb").to_str().unwrap().to_string(),
  ];

  let index = PartialIndex::with_view_roots(&[app.clone(), engine.clone()], templates);
  let resolved = index.resolve("billing/invoice", None);

  assert_eq!(2, resolved.len());
  assert!(resolved[0].starts_with(app.to_str().unwrap()), "app view path should win, got {}", resolved[0]);
}

#[test]
fn resolves_a_sibling_within_the_root_that_owns_the_caller() {
  let root = scratch("sibling");
  let app = root.join("app/views");
  let engine = root.join("engines/billing/app/views");

  write(&engine.join("billing/index.html.erb"), "<div></div>\n");
  write(&engine.join("billing/_row.html.erb"), "<div></div>\n");

  let templates = vec![
    engine.join("billing/index.html.erb").to_str().unwrap().to_string(),
    engine.join("billing/_row.html.erb").to_str().unwrap().to_string(),
  ];

  let index = PartialIndex::with_view_roots(&[app, engine.clone()], templates);
  let caller = engine.join("billing/index.html.erb").to_str().unwrap().to_string();

  assert_eq!(1, index.resolve("row", Some(&caller)).len());
}

#[test]
fn a_single_root_behaves_as_before() {
  let root = scratch("single");
  let app = root.join("app/views");

  write(&app.join("shared/_header.html.erb"), "<div></div>\n");

  let templates = vec![app.join("shared/_header.html.erb").to_str().unwrap().to_string()];
  let index = PartialIndex::new(&app, templates);

  assert_eq!(vec!["shared/header"], index.names());
  assert_eq!(1, index.resolve("shared/header", None).len());
}
