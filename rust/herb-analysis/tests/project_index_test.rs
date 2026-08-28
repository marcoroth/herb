use std::fs;
use std::path::PathBuf;

use herb_analysis::project_index::ProjectIndex;
use herb_analysis::render_graph::Verdict;

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_project_index_rs_{}_{}", name, std::process::id()));

    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("app/views/posts")).expect("create project");

    Self { root }
  }

  fn write(&self, path: &str, source: &str) -> String {
    let full = self.root.join(path);

    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(&full, source).expect("write");

    full.to_str().expect("utf8").to_string()
  }

  fn indexed(&self) -> ProjectIndex {
    let mut project = ProjectIndex::new(&self.root);
    project.index_all();

    project
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

#[test]
fn indexes_partials_and_call_sites() {
  let project = Project::new("index_all");
  project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let indexed = project.indexed();

  assert_eq!(indexed.partials().expect("partials").size(), 1);
  assert_eq!(indexed.graph().expect("graph").size(), 1);
  assert_eq!(
    indexed.graph().expect("graph").context_of(&row).ancestor_verdict(&[], &["table"]),
    Verdict::Always
  );
}

#[test]
fn re_analyzes_only_the_changed_template() {
  let project = Project::new("change");
  let entry = project.write(
    "app/views/posts/index.html.erb",
    r#"<html><body><table><%= render "posts/row" %></table></body></html>"#,
  );
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let mut indexed = project.indexed();

  fs::write(&entry, r#"<html><body><form><%= render "posts/row" %></form></body></html>"#).expect("rewrite");

  assert!(indexed.handle_change(&entry, None));

  let graph = indexed.graph().expect("graph");

  assert_eq!(graph.context_of(&row).ancestor_verdict(&[], &["table"]), Verdict::Never);
  assert_eq!(graph.context_of(&row).ancestor_verdict(&[], &["form"]), Verdict::Always);
}

#[test]
fn accepts_source_for_a_template_that_has_not_been_written_to_disk() {
  let project = Project::new("buffer");
  let entry = project.write("app/views/posts/index.html.erb", r#"<html><table><%= render "posts/row" %></table></html>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let mut indexed = project.indexed();

  indexed.handle_change(&entry, Some(r#"<html><form><%= render "posts/row" %></form></html>"#));

  assert_eq!(
    indexed.graph().expect("graph").context_of(&row).ancestor_verdict(&[], &["form"]),
    Verdict::Always
  );
}

#[test]
fn picks_up_a_partial_added_after_the_initial_index() {
  let project = Project::new("added");
  let entry = project.write("app/views/posts/index.html.erb", r#"<html><table><%= render "posts/row" %></table></html>"#);

  let mut indexed = project.indexed();
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  indexed.handle_change(&row, None);
  indexed.handle_change(&entry, None);

  assert_eq!(
    indexed.graph().expect("graph").context_of(&row).ancestor_verdict(&[], &["table"]),
    Verdict::Always
  );
}

#[test]
fn forgets_a_partial_that_was_deleted() {
  let project = Project::new("removed");
  project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let mut indexed = project.indexed();

  assert!(indexed.remove(&row));
  assert_eq!(indexed.partials().expect("partials").size(), 0);
}

#[test]
fn forgets_the_call_sites_of_a_deleted_template() {
  let project = Project::new("removed_caller");
  let entry = project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let mut indexed = project.indexed();

  assert!(indexed.remove(&entry));
  assert!(indexed.graph().expect("graph").callers_of(&row).is_empty());
}

#[test]
fn reports_no_change_for_a_file_that_is_not_a_template() {
  let project = Project::new("not_template");
  project.write("app/views/posts/index.html.erb", "<table></table>");

  let mut indexed = project.indexed();
  let readme = project.root.join("README.md").to_str().expect("utf8").to_string();

  assert!(!indexed.handle_change(&readme, None));
}

#[test]
fn exposes_the_view_root_it_resolved() {
  let project = Project::new("view_root");
  project.write("app/views/posts/index.html.erb", "<div></div>");

  assert_eq!(project.indexed().view_roots().expect("view roots"), [project.root.join("app/views")]);
}
