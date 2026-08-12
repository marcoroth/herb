use std::fs;
use std::path::PathBuf;

use herb_config::Config;

struct Fixture {
  _dir: tempfile::TempDir,
  root: PathBuf,
}

impl Fixture {
  fn new() -> Self {
    let dir = tempfile::tempdir().unwrap();
    let root = fs::canonicalize(dir.path()).unwrap();

    fs::create_dir_all(root.join("app/frontend/components")).unwrap();
    fs::create_dir_all(root.join("app/views/layouts")).unwrap();

    fs::write(root.join(".herb.yml"), "linter:\n  exclude:\n    - 'app/views/**/*.html.erb'\n").unwrap();
    fs::write(root.join("app/frontend/README.md"), "# Frontend\n").unwrap();
    fs::write(root.join("app/frontend/components/button.html.erb"), "<button></button>\n").unwrap();
    fs::write(root.join("app/views/layouts/application.html.erb"), "<html></html>\n").unwrap();

    Self { _dir: dir, root }
  }
}

#[test]
fn finds_project_root_with_a_herb_yml_over_subdirectory_with_readme_md() {
  let fixture = Fixture::new();
  let file_path = fixture.root.join("app/frontend/components/button.html.erb");

  assert_eq!(Config::find_project_root_sync(&file_path), fixture.root);
}

#[test]
fn finds_project_root_from_deeply_nested_file_path() {
  let fixture = Fixture::new();
  let file_path = fixture.root.join("app/views/layouts/application.html.erb");

  assert_eq!(Config::find_project_root_sync(&file_path), fixture.root);
}

#[test]
fn prefers_a_herb_yml_over_soft_project_indicators_like_readme_md() {
  let fixture = Fixture::new();
  let file_path = fixture.root.join("app/frontend/components/button.html.erb");

  let project_root = Config::find_project_root_sync(&file_path);

  assert_ne!(project_root, fixture.root.join("app/frontend"));
  assert_eq!(project_root, fixture.root);
}
