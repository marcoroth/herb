use herb_analysis::ruby_locals_index::{Local, RubyLocalsIndex};

fn index_for(source: &str) -> RubyLocalsIndex {
  RubyLocalsIndex::from_source(source)
}

fn text_at(source: &str, location: &herb::location::Location) -> String {
  let line = source.split('\n').nth(location.start.line as usize - 1).unwrap_or_default();

  line
    .get(location.start.column as usize..location.end.column as usize)
    .unwrap_or_default()
    .to_string()
}

fn lines_of(local: &Local) -> Vec<u32> {
  std::iter::once(local.declaration.start.line)
    .chain(local.usages.iter().map(|usage| usage.start.line))
    .collect()
}

#[test]
fn reports_nothing_for_a_template_without_locals() {
  assert!(index_for("<div>hello</div>").locals.is_empty());
}

#[test]
fn pairs_a_strict_local_with_the_places_it_is_read() {
  let source = "<%# locals: (title:, count: 0) %>\n\n<h1><%= title %></h1>\n<p><%= count %></p>\n";
  let index = index_for(source);

  let title = index.find("title").expect("title");

  assert_eq!(vec![1, 3], lines_of(title));
  assert_eq!("title", text_at(source, &title.declaration));

  let usages: Vec<String> = title.usages.iter().map(|usage| text_at(source, usage)).collect();
  assert_eq!(vec!["title".to_string()], usages);

  assert_eq!(vec![1, 4], lines_of(index.find("count").expect("count")));
}

#[test]
fn leaves_the_colon_out_of_a_strict_local_declaration() {
  let source = "<%# locals: (title:) %>\n<p><%= title %></p>\n";

  assert_eq!("title", text_at(source, &index_for(source).find("title").expect("title").declaration));
}

#[test]
fn reports_a_strict_local_that_is_never_read() {
  let source = "<%# locals: (unused:) %>\n<p>nothing</p>\n";
  let index = index_for(source);
  let local = index.find("unused").expect("unused");

  assert_eq!("unused", local.name);
  assert!(local.usages.is_empty());
}

#[test]
fn follows_a_local_passed_with_shorthand_hash_syntax() {
  let source = "<%# locals: (user:, favorite_user:) %>\n\n<%= render \"profiles/header\", user:, favorite_user: %>\n";
  let index = index_for(source);

  assert_eq!(vec![1, 3], lines_of(index.find("user").expect("user")));
  assert_eq!("user", text_at(source, &index.find("user").expect("user").usages[0]));
  assert_eq!("favorite_user", text_at(source, &index.find("favorite_user").expect("favorite_user").usages[0]));
}

#[test]
fn pairs_a_block_parameter_with_the_places_it_is_read() {
  let source = "<% posts.each do |post| %>\n  <%= post.title %>\n<% end %>\n";
  let index = index_for(source);
  let local = index.find("post").expect("post");

  assert_eq!(vec![1, 2], lines_of(local));
  assert_eq!("post", text_at(source, &local.declaration));
}

#[test]
fn keeps_two_blocks_taking_the_same_parameter_name_apart() {
  let source = "<% posts.each do |post| %>\n  <%= post.title %>\n<% end %>\n<% drafts.each do |post| %>\n  <%= post.body %>\n<% end %>\n";
  let index = index_for(source);

  let lines: Vec<Vec<u32>> = index.locals.iter().map(lines_of).collect();

  assert_eq!(vec![vec![1, 2], vec![4, 5]], lines);
}

#[test]
fn keeps_a_block_parameter_that_shadows_a_strict_local_separate() {
  let source = "<%# locals: (user:) %>\n<% users.each do |user| %>\n  <%= user %>\n<% end %>\n<%= render \"x\", user: %>\n";
  let index = index_for(source);

  let lines: Vec<Vec<u32>> = index.locals.iter().map(lines_of).collect();

  assert_eq!(vec![vec![1, 5], vec![2, 3]], lines);
}

#[test]
fn answers_with_the_innermost_binding_for_a_shadowed_position() {
  let source = "<%# locals: (user:) %>\n<% users.each do |user| %>\n  <%= user %>\n<% end %>\n<%= render \"x\", user: %>\n";
  let index = index_for(source);

  assert_eq!(2, index.at(3, 8).expect("inner").declaration.start.line);
  assert_eq!(1, index.at(1, 15).expect("declaration").declaration.start.line);
  assert_eq!(1, index.at(5, 18).expect("outer usage").declaration.start.line);
}

#[test]
fn returns_nothing_for_a_position_that_is_not_on_a_local() {
  let source = "<%# locals: (title:) %>\n<p><%= title %></p>\n";

  assert!(index_for(source).at(2, 1).is_none());
}

#[test]
fn reports_assignment_names_separately_from_block_parameters() {
  let source = "<% total = 0 %>\n<% posts.each do |post| %>\n  <% total += 1 %>\n<% end %>\n";
  let index = index_for(source);

  assert!(index.assignment_names.contains("total"));
  assert!(!index.assignment_names.contains("post"));
  assert!(index.names().contains("post"));
}

#[test]
fn counts_columns_in_bytes_so_multibyte_content_does_not_shift_a_location() {
  let source = "<%# locals: (title:) %>\n<p>über</p>\n<p><%= title %></p>\n";
  let index = index_for(source);
  let local = index.find("title").expect("title");

  assert_eq!(3, local.usages[0].start.line);
  assert_eq!("title", text_at(source, &local.declaration));
}

#[test]
fn indexes_a_state_declaration_like_a_local() {
  let source = "<%# herb:state (pending: false, attempts: 0) %>\n<p><%= pending? %></p>\n<p><%= attempts %></p>\n";
  let index = index_for(source);

  assert_eq!(vec![1, 2], lines_of(index.find("pending").expect("pending")));
  assert_eq!(vec![1, 3], lines_of(index.find("attempts").expect("attempts")));
}

#[test]
fn indexes_a_state_declared_inside_a_loop() {
  let source = "<% @items.each do |item| %>\n  <%# herb:state (locked: true) %>\n  <p><%= locked %></p>\n<% end %>\n";
  let index = index_for(source);

  assert_eq!(vec![2, 3], lines_of(index.find("locked").expect("locked")));
}

#[test]
fn ignores_a_plain_comment_that_is_not_a_state_directive() {
  let index = index_for("<%# locked drives the row %>\n<p>static</p>\n");

  assert!(index.find("locked").is_none());
}

#[test]
fn keeps_a_quoted_comma_inside_one_state_default() {
  let source = "<%# herb:state (draft: \"a,b\", open: false) %>\n<p><%= draft %></p>\n";
  let index = index_for(source);

  assert!(index.find("draft").is_some());
  assert!(index.find("open").is_some());
  assert!(index.find("b\"").is_none());
}
