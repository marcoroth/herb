use std::fs;
use std::path::PathBuf;

use herb_analysis::ruby_render_references::{self, RubyRenderReferences};

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_ruby_refs_{}_{}", name, std::process::id()));

    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("app/controllers")).expect("create project");

    Self { root }
  }

  fn write(&self, path: &str, source: &str) {
    let full = self.root.join(path);

    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(&full, source).expect("write");
  }

  fn collect(&self) -> RubyRenderReferences {
    ruby_render_references::collect(&self.root)
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

fn from_source(source: &str) -> RubyRenderReferences {
  let mut references = RubyRenderReferences::default();
  ruby_render_references::collect_from_source(source, &mut references);

  references
}

#[test]
fn finds_a_partial_rendered_from_a_controller() {
  let project = Project::new("controller");
  project.write(
    "app/controllers/posts_controller.rb",
    "class PostsController\n  def show\n    render \"posts/card\"\n  end\nend\n",
  );

  let references = project.collect();

  assert!(references.names.contains("posts/card"));
  assert!(references.covers("posts/card"));
}

#[test]
fn finds_a_partial_rendered_with_the_partial_keyword() {
  let references = from_source("render partial: \"posts/card\"");

  assert!(references.covers("posts/card"));
}

#[test]
fn records_a_prefix_for_an_interpolated_render() {
  let references = from_source("render \"widgets/#{kind}\"");

  assert!(references.prefixes.contains("widgets/"));
  assert!(references.covers("widgets/alpha"));
  assert!(!references.covers("posts/alpha"));
}

#[test]
fn does_not_cover_an_unrelated_partial() {
  let references = from_source("render \"posts/card\"");

  assert!(!references.covers("posts/other"));
}

#[test]
fn ignores_a_render_of_something_that_is_not_a_partial_name() {
  let references = from_source("render json: { ok: true }");

  assert!(references.names.is_empty());
}

#[test]
fn scans_lib_as_well_as_app() {
  let project = Project::new("lib");
  project.write("lib/exporter.rb", "class Exporter\n  def call\n    render \"exports/row\"\n  end\nend\n");

  assert!(project.collect().covers("exports/row"));
}

#[test]
fn reports_how_many_ruby_files_it_scanned() {
  let project = Project::new("counts");
  project.write("app/controllers/posts_controller.rb", "class PostsController; end\n");
  project.write("app/controllers/pages_controller.rb", "class PagesController; end\n");

  assert_eq!(project.collect().files_scanned, 2);
}

#[test]
fn returns_nothing_for_a_project_without_ruby_directories() {
  let project = Project::new("empty");
  let _ = fs::remove_dir_all(project.root.join("app"));

  let references = project.collect();

  assert!(references.names.is_empty());
  assert_eq!(references.files_scanned, 0);
}

#[test]
fn finds_a_partial_assigned_with_self_partial() {
  let references = from_source("self.partial = \"posts/card\"");

  assert!(references.covers("posts/card"));
}

#[test]
fn finds_a_partial_assigned_to_a_local_variable() {
  let references = from_source("partial = \"posts/card\"");

  assert!(references.covers("posts/card"));
}

#[test]
fn finds_a_partial_assigned_to_an_instance_variable() {
  let references = from_source("@partial = \"posts/card\"");

  assert!(references.covers("posts/card"));
}

#[test]
fn records_a_prefix_for_an_interpolated_partial_assignment() {
  let references = from_source("self.partial = \"widgets/#{kind}\"");

  assert!(references.covers("widgets/alpha"));
}

#[test]
fn ignores_an_assignment_to_an_unrelated_name() {
  let references = from_source("template = \"posts/card\"");

  assert!(!references.covers("posts/card"));
}

#[test]
fn resolves_an_object_render_to_its_conventional_partial() {
  use herb_analysis::template_dependencies::object_partial_name;

  assert_eq!(object_partial_name("@post").as_deref(), Some("posts/post"));
  assert_eq!(object_partial_name("@posts").as_deref(), Some("posts/post"));
  assert_eq!(object_partial_name("post").as_deref(), Some("posts/post"));
  assert_eq!(object_partial_name("@post.author"), None);
  assert_eq!(object_partial_name(""), None);
}
