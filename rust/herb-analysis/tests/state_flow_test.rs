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

#[test]
fn numbers_a_node_the_way_the_slot_visitor_does() {
  let project = Project::new("path_nested");
  let entry = project.write("app/views/posts/show.html.erb", "<div><h1><%= @title %></h1></div>");

  let paths: Vec<Vec<usize>> = project.flow().affected_nodes(&entry, "@title").into_iter().map(|node| node.node_path).collect();

  assert_eq!(paths, vec![vec![0, 0, 0]]);
}

#[test]
fn numbers_a_conditional_by_the_element_body_it_sits_in() {
  let project = Project::new("path_conditional");
  let entry = project.write("app/views/posts/show.html.erb", "<div><% if @admin %><%= @name %><% end %></div>");

  let paths: Vec<Vec<usize>> = project.flow().affected_nodes(&entry, "@admin").into_iter().map(|node| node.node_path).collect();

  assert_eq!(paths, vec![vec![0, 0]]);
}

#[test]
fn gives_an_attribute_the_path_of_the_element_that_carries_it() {
  let project = Project::new("path_attribute");
  let entry = project.write("app/views/posts/show.html.erb", "<div class=\"<%= @klass %>\"></div>");

  let paths: Vec<Vec<usize>> = project.flow().affected_nodes(&entry, "@klass").into_iter().map(|node| node.node_path).collect();

  assert_eq!(paths, vec![vec![0]]);
}

#[test]
fn gives_a_nested_attribute_the_path_of_its_own_element() {
  let project = Project::new("path_nested_attribute");
  let entry = project.write("app/views/posts/show.html.erb", "<div><a href=\"<%= @url %>\">x</a></div>");

  let paths: Vec<Vec<usize>> = project.flow().affected_nodes(&entry, "@url").into_iter().map(|node| node.node_path).collect();

  assert_eq!(paths, vec![vec![0, 0]]);
}

#[test]
fn does_not_confuse_a_state_name_with_a_longer_one() {
  let project = Project::new("prefix");
  let entry = project.write("app/views/posts/show.html.erb", "<div><%= @post.title %></div><div><%= @posts.count %></div>");

  let expressions: Vec<String> = project
    .flow()
    .affected_nodes(&entry, "@post")
    .into_iter()
    .filter_map(|node| node.expression)
    .collect();

  assert_eq!(expressions, vec!["@post.title".to_string()]);
}

#[test]
fn follows_state_through_a_block_parameter() {
  let project = Project::new("alias_param");
  let entry = project.write(
    "app/views/posts/index.html.erb",
    "<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>",
  );

  let expressions: Vec<String> = project
    .flow()
    .affected_nodes(&entry, "@items")
    .into_iter()
    .filter_map(|node| node.expression)
    .collect();

  assert!(expressions.iter().any(|code| code == "item.name"), "got {expressions:?}");
}

#[test]
fn follows_state_through_every_parameter_a_block_binds() {
  let project = Project::new("alias_params");
  let entry = project.write(
    "app/views/posts/index.html.erb",
    "<ul><% @rows.each_with_index do |row, i| %><li><%= i %>: <%= row.title %></li><% end %></ul>",
  );

  let expressions: Vec<String> = project
    .flow()
    .affected_nodes(&entry, "@rows")
    .into_iter()
    .filter_map(|node| node.expression)
    .collect();

  assert!(expressions.iter().any(|code| code == "row.title"), "got {expressions:?}");
  assert!(expressions.iter().any(|code| code == "i"), "got {expressions:?}");
}

#[test]
fn leaves_an_expression_a_block_parameter_does_not_reach() {
  let project = Project::new("alias_unrelated");
  let entry = project.write("app/views/posts/index.html.erb", "<div><% @items.each do |item| %><%= other %><% end %></div>");

  let expressions: Vec<String> = project
    .flow()
    .affected_nodes(&entry, "@items")
    .into_iter()
    .filter_map(|node| node.expression)
    .collect();

  assert!(!expressions.iter().any(|code| code == "other"), "got {expressions:?}");
}

#[test]
fn stops_a_block_parameter_at_the_end_of_its_block() {
  let project = Project::new("alias_scope");
  let entry = project.write(
    "app/views/posts/index.html.erb",
    "<div><% @items.each do |item| %><%= item.name %><% end %><%= item %></div>",
  );

  let expressions: Vec<String> = project
    .flow()
    .affected_nodes(&entry, "@items")
    .into_iter()
    .filter_map(|node| node.expression)
    .collect();

  assert_eq!(1, expressions.iter().filter(|code| *code == "item.name").count(), "got {expressions:?}");
  assert_eq!(0, expressions.iter().filter(|code| *code == "item").count(), "got {expressions:?}");
}

#[test]
fn records_a_block_the_way_ruby_does() {
  let project = Project::new("alias_block");
  let entry = project.write("app/views/posts/index.html.erb", "<ul><% @items.each do |item| %><li>x</li><% end %></ul>");

  let nodes = project.flow().affected_nodes(&entry, "@items");
  let block = nodes.iter().find(|node| node.kind == "expression");

  assert!(block.is_some(), "got {nodes:?}");
  assert_eq!(vec![0, 0], block.unwrap().node_path);
}

#[test]
fn reports_what_the_ruby_collector_reports() {
  let project = Project::new("alias_parity");
  let entry = project.write(
    "app/views/posts/index.html.erb",
    "<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>",
  );

  let reported: Vec<(String, Vec<usize>, Option<String>)> = project
    .flow()
    .affected_nodes(&entry, "@items")
    .into_iter()
    .map(|node| (node.kind, node.node_path, node.expression))
    .collect();

  assert_eq!(
    vec![
      ("expression".to_string(), vec![0, 0], Some("@items.each do |item|".to_string())),
      ("text_content".to_string(), vec![0, 0, 0, 0], Some("item.name".to_string())),
    ],
    reported
  );
}

fn expressions_for(name: &str, template: &str, state: &str) -> Vec<String> {
  let project = Project::new(name);
  let entry = project.write("app/views/posts/index.html.erb", template);

  project
    .flow()
    .affected_nodes(&entry, state)
    .into_iter()
    .filter_map(|node| node.expression)
    .collect()
}

#[test]
fn follows_state_into_a_local_assigned_from_it() {
  assert_eq!(
    vec!["total = @items.size".to_string(), "total".to_string()],
    expressions_for("assign_simple", "<% total = @items.size %><p><%= total %></p>", "@items")
  );
}

#[test]
fn follows_state_through_a_chain_of_assignments() {
  assert_eq!(
    vec!["a = @items.size".to_string(), "b = a * 2".to_string(), "b".to_string()],
    expressions_for("assign_chain", "<% a = @items.size %><% b = a * 2 %><p><%= b %></p>", "@items")
  );
}

#[test]
fn leaves_a_local_assigned_from_something_else() {
  assert!(expressions_for("assign_unrelated", "<% other = 5 %><p><%= other %></p>", "@items").is_empty());
}

#[test]
fn does_not_take_a_comparison_for_an_assignment() {
  assert_eq!(
    vec!["if @items == other".to_string()],
    expressions_for("assign_comparison", "<% if @items == other %><p><%= other %></p><% end %>", "@items")
  );
}

#[test]
fn stops_a_local_assigned_inside_a_block_at_the_end_of_it() {
  assert_eq!(
    vec!["@rows.each do |r|".to_string(), "inner = r.x".to_string(), "inner".to_string()],
    expressions_for(
      "assign_scope",
      "<% @rows.each do |r| %><% inner = r.x %><%= inner %><% end %><%= inner %>",
      "@rows"
    )
  );
}
