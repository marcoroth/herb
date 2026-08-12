#![cfg(feature = "cli")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_actionview_cli_{}_{}", name, std::process::id()));

    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("app/views/posts")).expect("create project");
    fs::create_dir_all(root.join("app/views/layouts")).expect("create layouts");

    Self { root }
  }

  fn write(&self, path: &str, source: &str) -> String {
    let full = self.root.join(path);

    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(&full, source).expect("write");

    full.to_str().expect("utf8").to_string()
  }

  fn run(&self, arguments: &[&str]) -> (String, i32) {
    let binary = PathBuf::from(env!("CARGO_BIN_EXE_herb-analysis"));

    let output = Command::new(binary)
      .arg("actionview")
      .args(arguments)
      .env("NO_COLOR", "1")
      .output()
      .expect("run herb-analysis");

    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    (text, output.status.code().unwrap_or(-1))
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

fn project_with_layout(name: &str) -> Project {
  let project = Project::new(name);

  project.write("app/views/layouts/application.html.erb", "<html><body><main><%= yield %></main></body></html>");
  project.write(
    "app/views/posts/index.html.erb",
    "<h1><%= @post.title %></h1>\n<table><%= render \"posts/row\", post: @post %></table>\n",
  );
  project.write("app/views/posts/_row.html.erb", "<%# locals: (post:) %>\n<tr><td><%= post.title %></td></tr>\n");

  project
}

#[test]
fn check_reports_a_project_where_every_render_resolves() {
  let project = project_with_layout("check_clean");
  let (output, status) = project.run(&["check", project.root.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("All render calls resolve"), "{output}");
}

#[test]
fn check_reports_a_render_that_cannot_be_resolved() {
  let project = Project::new("check_unresolved");
  project.write("app/views/posts/index.html.erb", "<%= render \"posts/missing\" %>");

  let (output, status) = project.run(&["check", project.root.to_str().expect("utf8")]);

  assert_eq!(status, 1);
  assert!(output.contains("Unresolved render calls"), "{output}");
  assert!(output.contains("posts/missing"), "{output}");
}

#[test]
fn check_reports_a_partial_nothing_renders() {
  let project = Project::new("check_unused");
  project.write("app/views/posts/index.html.erb", "<p>hello</p>");
  project.write("app/views/posts/_orphan.html.erb", "<tr></tr>");

  let (output, status) = project.run(&["check", project.root.to_str().expect("utf8")]);

  assert_eq!(status, 1);
  assert!(output.contains("Partials nothing renders"), "{output}");
}

#[test]
fn graph_shows_the_call_sites_of_each_partial() {
  let project = project_with_layout("graph");
  let (output, status) = project.run(&["graph", project.root.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("posts/row"), "{output}");
  assert!(output.contains("index.html.erb"), "{output}");
}

#[test]
fn dependencies_reports_the_manifest_for_a_template() {
  let project = project_with_layout("dependencies");
  let entry = project.root.join("app/views/posts/index.html.erb");
  let (output, status) = project.run(&["dependencies", entry.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("@post"), "{output}");
  assert!(output.contains("Locals passed to partials"), "{output}");
}

#[test]
fn flow_traces_state_into_a_partial() {
  let project = project_with_layout("flow");
  let entry = project.root.join("app/views/posts/index.html.erb");
  let (output, status) = project.run(&["flow", entry.to_str().expect("utf8"), "@post"]);

  assert_eq!(status, 0);
  assert!(output.contains("State flow"), "{output}");
  assert!(output.contains("_row.html.erb"), "{output}");
  assert!(output.contains("post: @post"), "{output}");
}

#[test]
fn flow_lists_the_available_state_when_none_is_given() {
  let project = project_with_layout("flow_available");
  let entry = project.root.join("app/views/posts/index.html.erb");
  let (output, status) = project.run(&["flow", entry.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("Available state"), "{output}");
  assert!(output.contains("@post"), "{output}");
}

#[test]
fn flow_reports_an_unknown_state_with_a_failure() {
  let project = project_with_layout("flow_unknown");
  let entry = project.root.join("app/views/posts/index.html.erb");
  let (output, status) = project.run(&["flow", entry.to_str().expect("utf8"), "@missing"]);

  assert_eq!(status, 1);
  assert!(output.contains("is not read by this template"), "{output}");
}

#[test]
fn context_reaches_the_document_root_through_a_layout() {
  let project = project_with_layout("context");
  let row = project.root.join("app/views/posts/_row.html.erb");
  let (output, status) = project.run(&["context", row.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("html"), "{output}");
  assert!(output.contains("table always"), "{output}");
}

#[test]
fn context_reports_a_partial_nothing_renders() {
  let project = Project::new("context_orphan");
  let orphan = project.write("app/views/posts/_orphan.html.erb", "<tr></tr>");
  let (output, status) = project.run(&["context", &orphan]);

  assert_eq!(status, 0);
  assert!(output.contains("Not rendered by any template"), "{output}");
}

#[test]
fn signature_infers_and_diffs_strict_locals() {
  let project = project_with_layout("signature");
  let row = project.root.join("app/views/posts/_row.html.erb");
  let (output, status) = project.run(&["signature", row.to_str().expect("utf8")]);

  assert_eq!(status, 0);
  assert!(output.contains("Inferred"), "{output}");
  assert!(output.contains("Declared"), "{output}");
  assert!(output.contains("required post"), "{output}");
}

#[test]
fn signature_flags_a_local_that_is_passed_but_not_declared() {
  let project = Project::new("signature_undeclared");
  project.write("app/views/posts/index.html.erb", "<%= render \"posts/row\", post: post, extra: extra %>");
  let row = project.write("app/views/posts/_row.html.erb", "<%# locals: (post:) %>\n<tr></tr>");

  let (output, status) = project.run(&["signature", &row]);

  assert_eq!(status, 0);
  assert!(output.contains("Passed but not declared"), "{output}");
  assert!(output.contains("extra"), "{output}");
}

#[test]
fn render_extracts_the_static_html() {
  let project = Project::new("render");
  let row = project.write("app/views/posts/_row.html.erb", "<tr><td><%= post.title %></td></tr>");

  let (output, status) = project.run(&["render", &row]);

  assert_eq!(status, 0);
  assert!(output.contains("<tr>"), "{output}");
}

#[test]
fn an_unknown_subcommand_exits_with_a_failure() {
  let project = Project::new("unknown");
  let (output, status) = project.run(&["nonsense"]);

  assert_eq!(status, 1);
  assert!(output.contains("Unknown actionview subcommand"), "{output}");
}

#[test]
fn no_subcommand_prints_the_usage() {
  let project = Project::new("usage");
  let (output, status) = project.run(&[]);

  assert_eq!(status, 0);
  assert!(output.contains("Herb ActionView Commands"), "{output}");
  assert!(output.contains("signature <partial>"), "{output}");
}
