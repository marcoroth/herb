use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use herb_analysis::partial_index::PartialIndex;
use herb_analysis::render_graph::{RenderGraph, Verdict};
use herb_analysis::render_graph_builder::Builder;

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_graph_builder_{}_{}", name, std::process::id()));

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

  fn graph(&self, resolve_layouts: bool) -> RenderGraph {
    let mut index = PartialIndex::build(&self.root);
    let templates = index.templates().to_vec();

    Builder::with_layouts(&mut index, resolve_layouts).build(&templates)
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

fn collect(project: &Project, file: &str, source: &str) -> (BTreeMap<String, Vec<herb_analysis::render_graph::PartialCallSite>>, usize) {
  let mut index = PartialIndex::build(&project.root);
  let mut builder = Builder::new(&mut index);
  let mut sites = BTreeMap::new();
  let collected = builder.collect_call_sites(file, source, &mut sites);

  (sites, collected.unresolved)
}

#[test]
fn records_the_ancestors_a_partial_is_rendered_under() {
  let project = Project::new("ancestors");
  project.write("app/views/posts/_row.html.erb", "<tr></tr>");
  let entry = project.write("app/views/posts/index.html.erb", r#"<table><tbody><%= render "posts/row" %></tbody></table>"#);

  let (sites, _) = collect(&project, &entry, &fs::read_to_string(&entry).expect("read"));
  let call_site = sites.values().next().expect("site").first().expect("first");

  assert_eq!(call_site.ancestors, vec!["table", "tbody"]);
}

#[test]
fn records_the_locals_a_call_site_passes() {
  let project = Project::new("locals");
  project.write("app/views/posts/_row.html.erb", "<tr></tr>");
  let entry = project.write("app/views/posts/index.html.erb", r#"<%= render "posts/row", post: post, index: index %>"#);

  let (sites, _) = collect(&project, &entry, &fs::read_to_string(&entry).expect("read"));
  let call_site = sites.values().next().expect("site").first().expect("first");

  assert_eq!(call_site.locals, vec!["post", "index"]);
}

#[test]
fn captures_a_static_class_attribute_from_an_ancestor() {
  let project = Project::new("attributes");
  project.write("app/views/posts/_row.html.erb", "<tr></tr>");
  let entry = project.write("app/views/posts/index.html.erb", r#"<table class="grid"><%= render "posts/row" %></table>"#);

  let (sites, _) = collect(&project, &entry, &fs::read_to_string(&entry).expect("read"));
  let call_site = sites.values().next().expect("site").first().expect("first");
  let attributes = call_site.ancestor_attributes.as_ref().expect("attributes");

  assert_eq!(attributes[0].get("class"), Some(&"grid".to_string()));
}

#[test]
fn counts_a_render_it_cannot_resolve_to_a_partial() {
  let project = Project::new("unresolved");
  let entry = project.write("app/views/posts/index.html.erb", r#"<%= render "posts/missing" %>"#);

  let (sites, unresolved) = collect(&project, &entry, &fs::read_to_string(&entry).expect("read"));

  assert!(sites.is_empty());
  assert_eq!(unresolved, 1);
}

#[test]
fn counts_a_dynamic_render_as_unresolved() {
  let project = Project::new("dynamic");
  let entry = project.write("app/views/posts/index.html.erb", "<%= render @post %>");

  let (_, unresolved) = collect(&project, &entry, &fs::read_to_string(&entry).expect("read"));

  assert_eq!(unresolved, 1);
}

#[test]
fn builds_a_graph_over_every_template() {
  let project = Project::new("build");
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");
  project.write("app/views/posts/index.html.erb", r#"<html><table><%= render "posts/row" %></table></html>"#);

  let graph = project.graph(true);

  assert_eq!(graph.size(), 1);
  assert_eq!(graph.context_of(&row).ancestor_verdict(&[], &["table"]), Verdict::Always);
}

#[test]
fn prefixes_a_partial_context_with_the_ancestors_from_its_layout() {
  let project = Project::new("layout_chain");
  project.write("app/views/layouts/application.html.erb", "<html><body><main><%= yield %></main></body></html>");
  project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let context = project.graph(true).context_of(&row);

  assert_eq!(context.chains.len(), 1);
  assert_eq!(context.chains[0].tags, vec!["html", "body", "main", "table"]);
}

#[test]
fn resolves_the_context_once_a_layout_supplies_the_document_root() {
  let project = Project::new("layout_resolved");
  project.write("app/views/layouts/application.html.erb", "<html><body><%= yield %></body></html>");
  project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let context = project.graph(true).context_of(&row);

  assert!(context.resolved);
  assert_eq!(context.ancestor_verdict(&[], &["form"]), Verdict::Never);
}

#[test]
fn leaves_the_context_unresolved_when_layouts_are_not_resolved() {
  let project = Project::new("layout_off");
  project.write("app/views/layouts/application.html.erb", "<html><body><%= yield %></body></html>");
  project.write("app/views/posts/index.html.erb", r#"<table><%= render "posts/row" %></table>"#);
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  let context = project.graph(false).context_of(&row);

  assert!(!context.resolved);
  assert_eq!(context.ancestor_verdict(&[], &["form"]), Verdict::Unknown);
}

#[test]
fn ignores_a_yield_that_names_a_content_area() {
  let project = Project::new("named_yield");
  project.write("app/views/layouts/application.html.erb", "<html><body><%= yield :sidebar %></body></html>");
  let entry = project.write("app/views/posts/index.html.erb", "<p>hello</p>");

  assert!(project.graph(true).callers_of(&entry).is_empty());
}

#[test]
fn records_the_layout_as_the_caller() {
  let project = Project::new("layout_caller");
  let layout = project.write("app/views/layouts/application.html.erb", "<html><body><%= yield %></body></html>");
  let entry = project.write("app/views/posts/index.html.erb", "<p>hello</p>");

  let graph = project.graph(true);
  let call_site = graph.callers_of(&entry).first().expect("call site");

  assert_eq!(call_site.via, "layout");
  assert_eq!(call_site.caller, layout);
}

#[test]
fn does_not_give_a_partial_a_layout() {
  let project = Project::new("partial_no_layout");
  project.write("app/views/layouts/application.html.erb", "<html><body><%= yield %></body></html>");
  let row = project.write("app/views/posts/_row.html.erb", "<tr></tr>");

  assert!(project.graph(true).callers_of(&row).is_empty());
}

#[test]
fn separates_root_tags_that_sit_behind_a_conditional() {
  let project = Project::new("conditional_roots");
  let entry = project.write("app/views/posts/_row.html.erb", "<tr></tr><% if admin? %><td></td><% end %>");

  let mut index = PartialIndex::build(&project.root);
  let mut builder = Builder::new(&mut index);
  let mut sites = BTreeMap::new();
  let collected = builder.collect_call_sites(&entry, &fs::read_to_string(&entry).expect("read"), &mut sites);

  assert_eq!(collected.roots.tags, vec!["tr"]);
  assert_eq!(collected.roots.conditional_tags, vec!["td"]);
}

#[test]
fn records_a_template_it_could_not_read_as_skipped() {
  let project = Project::new("skipped");
  let mut index = PartialIndex::build(&project.root);
  let missing = project.root.join("app/views/posts/missing.html.erb").to_str().expect("utf8").to_string();

  let graph = Builder::new(&mut index).build(&[missing]);

  assert_eq!(graph.skipped_file_count(), 1);
  assert!(!graph.is_complete());
}
