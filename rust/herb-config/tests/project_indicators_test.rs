use std::fs;

use herb_config::Config;

#[test]
fn find_project_root_falls_back_to_project_indicators() {
  let dir = tempfile::tempdir().unwrap();
  let root = fs::canonicalize(dir.path()).unwrap();

  fs::write(root.join("Gemfile"), "").unwrap();

  let sub_dir = root.join("app").join("views");
  fs::create_dir_all(&sub_dir).unwrap();

  assert_eq!(Config::find_project_root(&sub_dir), root);
}

#[test]
fn find_project_root_recognizes_gemspec_indicator() {
  let dir = tempfile::tempdir().unwrap();
  let root = fs::canonicalize(dir.path()).unwrap();

  fs::write(root.join("herb.gemspec"), "").unwrap();

  let sub_dir = root.join("lib");
  fs::create_dir_all(&sub_dir).unwrap();

  assert_eq!(Config::find_project_root(&sub_dir), root);
}

#[test]
fn find_project_root_sync_matches_find_project_root() {
  let dir = tempfile::tempdir().unwrap();
  let root = fs::canonicalize(dir.path()).unwrap();

  fs::write(root.join("Gemfile"), "").unwrap();

  assert_eq!(Config::find_project_root_sync(&root), Config::find_project_root(&root));
}
