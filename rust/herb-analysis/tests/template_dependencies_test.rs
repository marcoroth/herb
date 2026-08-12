use herb_analysis::template_dependencies::TemplateDependencies;

const FILE: &str = "app/views/posts/show.html.erb";

fn analyze(source: &str) -> herb_analysis::template_dependencies::Dependencies {
  TemplateDependencies::new().analyze_source(FILE, source)
}

#[test]
fn detects_instance_variables() {
  let result = analyze("<h1><%= @post.title %></h1><p><%= @user.name %></p>");

  assert!(result.instance_variables.contains(&"@post".to_string()));
  assert!(result.instance_variables.contains(&"@user".to_string()));
}

#[test]
fn detects_constants_with_method_calls() {
  let result = analyze("<%= Current.user %><%= Post.count %>");

  assert!(result.constants.contains(&"Current.user".to_string()));
  assert!(result.constants.contains(&"Post.count".to_string()));
}

#[test]
fn detects_strict_locals() {
  let result = analyze("<%# locals: (title:, body:) %>\n<h1><%= title %></h1>");

  assert!(result.locals_declared.contains(&"title".to_string()));
  assert!(result.locals_declared.contains(&"body".to_string()));
}

#[test]
fn detects_locals_passed_to_render_calls() {
  let result = analyze(r#"<%= render "shared/header", title: @post.title %>"#);

  assert_eq!(result.locals_received.get("title"), Some(&"@post.title".to_string()));
}

#[test]
fn detects_known_action_view_helpers() {
  let result = analyze(r#"<%= link_to "Home", "/" %>"#);

  assert!(result.helper_calls.contains(&"link_to".to_string()));
}

#[test]
fn flags_unknown_method_calls() {
  let result = analyze("<%= current_user.name %>");

  assert!(result.unknown_calls.contains(&"current_user".to_string()));
}

#[test]
fn does_not_flag_declared_locals_as_unknown() {
  let result = analyze("<%# locals: (title:) %>\n<h1><%= title %></h1>");

  assert!(!result.unknown_calls.contains(&"title".to_string()));
}

#[test]
fn records_a_static_render_call() {
  let result = analyze(r#"<%= render "posts/card", post: @post %>"#);

  assert_eq!(result.render_calls.len(), 1);
  assert_eq!(result.render_calls[0].partial, Some("posts/card".to_string()));
  assert_eq!(result.render_calls[0].locals.get("post"), Some(&"@post".to_string()));
}

#[test]
fn records_the_collection_of_a_collection_render() {
  let result = analyze(r#"<%= render partial: "posts/card", collection: @posts %>"#);

  assert_eq!(result.render_calls[0].collection, Some("@posts".to_string()));
}

#[test]
fn finds_the_instance_variable_behind_a_render_local() {
  let result = analyze(r#"<%= render "posts/byline", author: @post.user %>"#);

  assert!(result.instance_variables.contains(&"@post".to_string()));
}

#[test]
fn does_not_treat_render_as_an_unknown_call() {
  let result = analyze(r#"<%= render "posts/card" %>"#);

  assert!(!result.unknown_calls.contains(&"render".to_string()));
}

#[test]
fn records_the_file_it_analyzed() {
  assert_eq!(analyze("<div></div>").file, FILE);
}

#[test]
fn agrees_with_the_ruby_implementation() {
  let cases: Vec<(&str, Vec<&str>, Vec<&str>, Vec<&str>, Vec<&str>)> = vec![
    (
      "<h1><%= @post.title %></h1><p><%= @user.name %></p>",
      vec!["@post", "@user"],
      vec![],
      vec![],
      vec![],
    ),
    (
      "<%= Current.user %><%= Post.count %>",
      vec![],
      vec!["Current.user", "Post.count"],
      vec![],
      vec![],
    ),
    (r#"<%= link_to "Home", "/" %>"#, vec![], vec![], vec!["link_to"], vec![]),
    ("<%= current_user.name %>", vec![], vec![], vec![], vec!["current_user"]),
    (
      r#"<%= render "posts/byline", author: @post.user %>"#,
      vec!["@post"],
      vec![],
      vec!["render"],
      vec![],
    ),
    (
      r#"<%= render partial: "posts/card", collection: @posts %>"#,
      vec!["@posts"],
      vec![],
      vec!["render"],
      vec![],
    ),
  ];

  for (source, ivars, constants, helpers, unknown) in cases {
    let result = analyze(source);

    assert_eq!(result.instance_variables, ivars, "instance_variables for {source}");
    assert_eq!(result.constants, constants, "constants for {source}");
    assert_eq!(result.helper_calls, helpers, "helper_calls for {source}");
    assert_eq!(result.unknown_calls, unknown, "unknown_calls for {source}");
  }
}
