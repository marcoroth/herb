use std::fs;
use std::path::PathBuf;

use herb_analysis::partial_index::PartialIndex;

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_partial_index_{}_{}", name, std::process::id()));

    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).expect("create project");

    Self { root }
  }

  fn write(&self, path: &str) -> String {
    let full = self.root.join(path);

    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(&full, "<div></div>\n").expect("write");

    full.to_str().expect("utf8").to_string()
  }

  fn write_source(&self, path: &str, source: &str) -> String {
    let full = self.root.join(path);

    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(&full, source).expect("write");

    full.to_str().expect("utf8").to_string()
  }

  fn index(&self) -> PartialIndex {
    PartialIndex::build(&self.root)
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

#[test]
fn resolves_the_view_root_to_app_views_when_it_is_there() {
  let project = Project::new("view_root");
  project.write("app/views/posts/index.html.erb");

  assert_eq!(project.index().view_roots(), [project.root.join("app/views")]);
}

#[test]
fn falls_back_to_the_project_root_when_there_is_no_app_views() {
  let project = Project::new("flat_root");
  project.write("posts/index.html.erb");

  assert_eq!(project.index().view_roots(), [project.root.as_path()].map(PathBuf::from));
}

#[test]
fn maps_a_qualified_partial_name_to_its_file() {
  let project = Project::new("qualified");
  let file = project.write("app/views/posts/_card.html.erb");

  assert_eq!(project.index().files_for("posts/card"), &[file]);
}

#[test]
fn maps_a_partial_at_the_view_root_without_a_directory_prefix() {
  let project = Project::new("root_partial");
  let file = project.write("app/views/_banner.html.erb");

  assert_eq!(project.index().files_for("banner"), &[file]);
}

#[test]
fn answers_with_nothing_for_a_name_it_does_not_know() {
  let project = Project::new("unknown");
  project.write("app/views/posts/_card.html.erb");

  assert!(project.index().files_for("posts/missing").is_empty());
}

#[test]
fn ignores_templates_that_are_not_partials() {
  let project = Project::new("not_partial");
  project.write("app/views/posts/index.html.erb");

  assert!(project.index().names().is_empty());
}

#[test]
fn finds_partials_written_with_the_herb_extension() {
  let project = Project::new("herb_ext");
  let file = project.write("app/views/posts/_card.html.herb");

  assert_eq!(project.index().files_for("posts/card"), &[file]);
}

#[test]
fn puts_the_preferred_variant_first_when_a_name_has_several() {
  let project = Project::new("variants");
  project.write("app/views/posts/_card.erb");
  let preferred = project.write("app/views/posts/_card.html.erb");

  assert_eq!(project.index().files_for("posts/card").first().expect("file"), &preferred);
}

#[test]
fn resolves_a_partial_named_relative_to_the_rendering_template() {
  let project = Project::new("sibling");
  let caller = project.write("app/views/posts/show.html.erb");
  let sibling = project.write("app/views/posts/_header.html.erb");

  assert_eq!(project.index().resolve("header", Some(&caller)), &[sibling]);
}

#[test]
fn falls_back_to_the_application_directory_for_an_unqualified_name() {
  let project = Project::new("application");
  let caller = project.write("app/views/posts/show.html.erb");
  let shared = project.write("app/views/application/_flash.html.erb");

  assert_eq!(project.index().resolve("flash", Some(&caller)), &[shared]);
}

#[test]
fn prefers_a_sibling_partial_over_the_application_fallback() {
  let project = Project::new("sibling_wins");
  let caller = project.write("app/views/posts/show.html.erb");
  let sibling = project.write("app/views/posts/_flash.html.erb");
  project.write("app/views/application/_flash.html.erb");

  assert_eq!(project.index().resolve("flash", Some(&caller)), &[sibling]);
}

#[test]
fn does_not_fall_back_to_application_for_a_qualified_name() {
  let project = Project::new("qualified_no_fallback");
  let caller = project.write("app/views/posts/show.html.erb");
  project.write("app/views/application/_flash.html.erb");

  assert!(project.index().resolve("admin/flash", Some(&caller)).is_empty());
}

#[test]
fn tracks_the_strict_locals_a_partial_declares() {
  let project = Project::new("strict_locals");
  project.write_source("app/views/posts/_card.html.erb", "<%# locals: (title:) %>\n<h1></h1>");

  let mut index = project.index();
  let declaration = index.lookup("posts/card", None).expect("declaration").clone();

  assert!(declaration.has_declaration);
  assert_eq!(declaration.required_locals(), vec!["title"]);
  assert!(!declaration.accepts("subtitle"));
}

#[test]
fn picks_up_a_partial_added_after_the_index_was_built() {
  let project = Project::new("update");
  project.write("app/views/posts/_card.html.erb");

  let mut index = project.index();
  let added = project.write("app/views/posts/_byline.html.erb");

  assert_eq!(index.update(&added), Some("posts/byline".to_string()));
  assert_eq!(index.size(), 2);
  assert_eq!(index.resolve("posts/byline", None), &[added]);
}

#[test]
fn forgets_a_partial_that_was_removed() {
  let project = Project::new("remove");
  let card = project.write("app/views/posts/_card.html.erb");

  let mut index = project.index();

  assert_eq!(index.remove(&card), Some("posts/card".to_string()));
  assert_eq!(index.size(), 0);
  assert!(index.resolve("posts/card", None).is_empty());
}
