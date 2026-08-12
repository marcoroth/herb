use herb_analysis::partial_resolution::*;

#[test]
fn derives_the_partial_glob_from_the_extension_list() {
  assert_eq!(partial_glob_pattern(), format!("_{}", template_glob_pattern()));
  assert_eq!(partial_glob_pattern(), "_*.{html.erb,html.herb,erb,herb,turbo_stream.erb,turbo_stream.herb}");
}

#[test]
fn recognises_a_template_path() {
  assert!(template_path("app/views/posts/index.html.erb"));
  assert!(template_path("app/views/posts/index.herb"));
  assert!(!template_path("app/views/posts/README.md"));
}

#[test]
fn recognises_a_partial_path() {
  assert!(partial_path("app/views/posts/_card.html.erb"));
  assert!(!partial_path("app/views/posts/index.html.erb"));
  assert!(!partial_path("app/views/posts/_card.md"));
}

#[test]
fn names_a_partial_relative_to_the_view_root() {
  assert_eq!(partial_name_for("app/views/posts/_card.html.erb", "app/views"), Some("posts/card".to_string()));
}

#[test]
fn names_a_partial_sitting_at_the_view_root() {
  assert_eq!(partial_name_for("app/views/_banner.html.erb", "app/views"), Some("banner".to_string()));
}

#[test]
fn keeps_a_dot_in_a_directory_name_out_of_the_partial_name() {
  assert_eq!(
    partial_name_for("app/views/posts.v2/_card.html.erb", "app/views"),
    Some("posts.v2/card".to_string())
  );
}

#[test]
fn does_not_name_a_file_outside_the_view_root() {
  assert_eq!(partial_name_for("other/place/_card.html.erb", "app/views"), None);
}

#[test]
fn does_not_name_a_partial_whose_name_is_only_an_extension() {
  assert_eq!(partial_name_for("app/views/_.html.erb", "app/views"), None);
}

#[test]
fn does_not_name_the_view_root_itself() {
  assert_eq!(partial_name_for("app/views", "app/views"), None);
}

#[test]
fn does_not_name_a_file_that_is_not_a_partial() {
  assert_eq!(partial_name_for("app/views/posts/index.html.erb", "app/views"), None);
}

#[test]
fn names_a_template_that_is_not_a_partial() {
  assert_eq!(
    template_name_for("app/views/posts/index.html.erb", "app/views"),
    Some("posts/index".to_string())
  );
  assert_eq!(template_name_for("app/views/posts/_card.html.erb", "app/views"), None);
}

#[test]
fn ranks_each_known_extension_by_its_position_in_the_list() {
  for (index, extension) in EXTENSIONS.iter().enumerate() {
    assert_eq!(template_rank(&format!("_card{}", extension)), index);
  }
}

#[test]
fn ranks_an_unknown_extension_last() {
  assert_eq!(template_rank("_card.md"), EXTENSIONS.len());
  assert_eq!(template_rank("_card"), EXTENSIONS.len());
}

#[test]
fn prefers_the_html_erb_variant_over_a_bare_erb_variant() {
  assert!(outranks_template("_card.html.erb", "_card.erb"));
  assert!(!outranks_template("_card.erb", "_card.html.erb"));
}

#[test]
fn breaks_a_rank_tie_alphabetically() {
  assert!(outranks_template("admin/_card.html.erb", "posts/_card.html.erb"));
}

#[test]
fn orders_variants_by_precedence() {
  let mut files = vec![
    "_card.turbo_stream.erb".to_string(),
    "_card.erb".to_string(),
    "_card.html.erb".to_string(),
    "_card.herb".to_string(),
  ];

  by_precedence(&mut files);

  assert_eq!(files, vec!["_card.html.erb", "_card.erb", "_card.herb", "_card.turbo_stream.erb"]);
}

// These six cases are checked byte for byte against the Ruby and TypeScript implementations.
#[test]
fn matches_the_other_implementations_on_layout_candidates() {
  assert_eq!(
    layout_candidates_for("app/views/posts/index.html.erb", "app/views"),
    vec!["layouts/posts", "layouts/application"]
  );

  assert_eq!(layout_candidates_for("app/views/index.html.erb", "app/views"), vec!["layouts/application"]);

  assert_eq!(
    layout_candidates_for("app/views/admin/posts/index.html.erb", "app/views"),
    vec!["layouts/admin/posts", "layouts/admin", "layouts/application"]
  );

  assert_eq!(
    layout_candidates_for("app/views/user_mailer/welcome.html.erb", "app/views"),
    vec!["layouts/user_mailer", "layouts/mailer"]
  );

  assert!(layout_candidates_for("app/views/layouts/application.html.erb", "app/views").is_empty());
  assert!(layout_candidates_for("app/views/posts/_row.html.erb", "app/views").is_empty());
}

// Every row here was produced by running the Ruby implementation over the same input, so the two
// stay pinned to one contract. The one deliberate difference is noted inline.
#[test]
fn agrees_with_the_ruby_implementation_over_a_table_of_paths() {
  let root = "app/views";

  let cases: Vec<(&str, Option<&str>, bool, bool, usize)> = vec![
    ("app/views/posts/_card.html.erb", Some("posts/card"), true, true, 0),
    ("app/views/_banner.html.erb", Some("banner"), true, true, 0),
    ("app/views/posts.v2/_card.html.erb", Some("posts.v2/card"), true, true, 0),
    ("app/views/a/b/c/_deep.turbo_stream.herb", Some("a/b/c/deep"), true, true, 5),
    ("app/views/posts/_card.erb", Some("posts/card"), true, true, 2),
    ("app/views/posts/_card.herb", Some("posts/card"), true, true, 3),
    ("app/views/posts/index.html.erb", None, false, true, 0),
    ("app/views/_.html.erb", None, true, true, 0),
    ("other/_card.html.erb", None, true, true, 0),
    ("app/views", None, false, false, 6),
    ("app/views/posts/_card.md", None, false, false, 6),
    ("app/views/layouts/application.html.erb", None, false, true, 0),
    ("app/views/user_mailer/_x.html.erb", Some("user_mailer/x"), true, true, 0),
  ];

  for (file, partial_name, is_partial, is_template, rank) in cases {
    assert_eq!(partial_name_for(file, root).as_deref(), partial_name, "partial_name_for({file})");
    assert_eq!(partial_path(file), is_partial, "partial_path({file})");
    assert_eq!(template_path(file), is_template, "template_path({file})");
    assert_eq!(template_rank(file), rank, "template_rank({file})");
  }

  assert_eq!(template_name_for("app/views/posts/index.html.erb", root).as_deref(), Some("posts/index"));
  assert_eq!(
    template_name_for("app/views/layouts/application.html.erb", root).as_deref(),
    Some("layouts/application")
  );

  // Both name functions gate on `partial_path`, which requires a template extension as well as the
  // `_` prefix, so a `.md` file is neither a partial nor rejected as one. TypeScript checks only the
  // prefix and so answers "posts/card" here; the inputs that separate them cannot reach either
  // function, since every caller feeds it glob results that already carry a template extension.
  assert_eq!(template_name_for("app/views/posts/_card.md", root).as_deref(), Some("posts/_card"));
}
