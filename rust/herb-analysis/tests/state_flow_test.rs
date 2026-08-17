use std::fs;
use std::path::PathBuf;

use herb_analysis::state_flow::StateFlow;

struct Project {
  root: PathBuf,
}

impl Project {
  fn new(name: &str) -> Self {
    let root = std::env::temp_dir().join(format!("herb_state_flow_{}_{}", name, std::process::id()));

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

  fn flow(&self) -> StateFlow {
    StateFlow::new(&self.root)
  }
}

impl Drop for Project {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

#[test]
fn reports_the_nodes_a_template_renders_from_the_state() {
  let project = Project::new("nodes");
  let entry = project.write("app/views/posts/show.html.erb", "<h1><%= @post.title %></h1>");

  let nodes = project.flow().affected_nodes(&entry, "@post");

  assert!(nodes.iter().any(|node| node.expression.as_deref() == Some("@post.title")));
}

#[test]
fn does_not_report_nodes_for_unrelated_state() {
  let project = Project::new("unrelated");
  let entry = project.write("app/views/posts/show.html.erb", "<h1><%= @post.title %></h1>");

  assert!(project.flow().affected_nodes(&entry, "@user").is_empty());
}

#[test]
fn reports_a_conditional_that_reads_the_state() {
  let project = Project::new("conditional");
  let entry = project.write("app/views/posts/show.html.erb", "<% if @post.draft? %><p>draft</p><% end %>");

  let nodes = project.flow().affected_nodes(&entry, "@post");

  assert!(nodes.iter().any(|node| node.kind == "conditional"));
}

#[test]
fn traces_state_into_a_partial() {
  let project = Project::new("into_partial");
  let entry = project.write("app/views/posts/show.html.erb", r#"<%= render "posts/header", post: @post %>"#);
  let header = project.write("app/views/posts/_header.html.erb", "<h1><%= post.title %></h1>");

  let affected = project.flow().affected_templates(&entry, "@post");

  assert!(affected.contains(&entry));
  assert!(affected.contains(&header));
}

#[test]
fn does_not_trace_state_the_template_never_reads() {
  let project = Project::new("never_read");
  let entry = project.write("app/views/posts/show.html.erb", "<h1><%= @post.title %></h1>");

  assert!(project.flow().affected_templates(&entry, "@user").is_empty());
}

#[test]
fn traces_state_through_a_rename_into_a_partial() {
  let project = Project::new("rename");
  let entry = project.write("app/views/posts/show.html.erb", r#"<%= render "posts/byline", author: @post.user %>"#);
  project.write("app/views/posts/_byline.html.erb", "<span><%= author.name %></span>");

  let flow = project.flow().state_flow(&entry, "@post").expect("flow");

  assert_eq!(flow.names, vec!["@post"]);
  assert_eq!(flow.children.len(), 1);
  assert_eq!(flow.children[0].names, vec!["author"]);
  assert_eq!(flow.children[0].via.get("author"), Some(&"@post.user".to_string()));
}

#[test]
fn traces_state_through_two_renames() {
  let project = Project::new("two_renames");
  let entry = project.write("app/views/posts/show.html.erb", r#"<%= render "posts/byline", author: @post.user %>"#);
  project.write("app/views/posts/_byline.html.erb", r#"<%= render "posts/avatar", user: author %>"#);
  project.write("app/views/posts/_avatar.html.erb", "<span><%= user.name %></span>");

  let flow = project.flow().state_flow(&entry, "@post").expect("flow");
  let avatar = &flow.children[0].children[0];

  assert_eq!(avatar.names, vec!["user"]);
  assert!(avatar.nodes.iter().any(|node| node.expression.as_deref() == Some("user.name")));
}

#[test]
fn branches_when_state_flows_into_two_partials() {
  let project = Project::new("branches");
  let entry = project.write(
    "app/views/posts/show.html.erb",
    r#"<%= render "posts/byline", author: @post.user %><%= render "posts/body", text: @post.body %>"#,
  );
  project.write("app/views/posts/_byline.html.erb", "<span><%= author %></span>");
  project.write("app/views/posts/_body.html.erb", "<p><%= text %></p>");

  let flow = project.flow().state_flow(&entry, "@post").expect("flow");
  let mut names: Vec<String> = flow.children.iter().map(|child| child.names[0].clone()).collect();
  names.sort();

  assert_eq!(names, vec!["author", "text"]);
}

#[test]
fn carries_the_item_name_into_a_collection_render() {
  let project = Project::new("collection");
  let entry = project.write(
    "app/views/posts/show.html.erb",
    r#"<%= render partial: "posts/comment", collection: @post.comments %>"#,
  );
  project.write("app/views/posts/_comment.html.erb", "<li><%= comment %></li>");

  let flow = project.flow().state_flow(&entry, "@post").expect("flow");

  assert!(flow.children[0].names.contains(&"comment".to_string()));
}

#[test]
fn stops_instead_of_looping_when_partials_render_each_other() {
  let project = Project::new("cycle");
  let entry = project.write("app/views/posts/show.html.erb", r#"<%= render "posts/a", value: @post %>"#);
  project.write("app/views/posts/_a.html.erb", r#"<%= render "posts/b", value: value %>"#);
  project.write("app/views/posts/_b.html.erb", r#"<%= render "posts/a", value: value %>"#);

  let flow = project.flow().state_flow(&entry, "@post").expect("flow");

  assert_eq!(flow.children[0].names, vec!["value"]);
}

#[test]
fn builds_a_reverse_index_from_state_to_nodes() {
  let project = Project::new("dependency_index");
  let entry = project.write("app/views/posts/show.html.erb", "<h1><%= @post.title %></h1><p><%= @user.name %></p>");

  let index = project.flow().dependency_index(&entry);

  assert!(index.contains_key("@post"));
  assert!(index.contains_key("@user"));
}

#[test]
fn reports_an_attribute_value_that_reads_the_state() {
  let project = Project::new("attribute");
  let entry = project.write("app/views/posts/show.html.erb", r#"<img src="<%= @post.avatar %>">"#);

  let nodes = project.flow().affected_nodes(&entry, "@post");

  assert!(nodes.iter().any(|node| node.kind == "attribute_value"));
}

#[test]
fn names_erb_output_in_text_the_same_way_ruby_does() {
  let project = Project::new("text_content");
  let entry = project.write("app/views/posts/show.html.erb", "<h1><%= @post.title %></h1>");

  let nodes = project.flow().affected_nodes(&entry, "@post");

  assert!(nodes.iter().any(|node| node.kind == "text_content"));
}
