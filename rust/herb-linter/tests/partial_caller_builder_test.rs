use std::fs;
use std::path::{Path, PathBuf};

use herb::action_view_partial_callers::strict_locals_declaration;
use herb_linter::partial_caller_builder::{build_partial_caller_index, PartialCallerIndexOptions};
use herb_linter::partial_index_builder::build_partial_index;

fn project(name: &str, files: &[(&str, &str)]) -> PathBuf {
  let root = std::env::temp_dir().join(format!("herb-caller-index-{name}"));

  let _ = fs::remove_dir_all(&root);

  for (path, contents) in files {
    let full = root.join(path);
    fs::create_dir_all(full.parent().expect("parent")).expect("create dir");
    fs::write(full, contents).expect("write file");
  }

  root
}

fn index(root: &Path, options: &PartialCallerIndexOptions) -> herb::action_view_partial_callers::PartialCallerIndex {
  let partials = build_partial_index(root);

  build_partial_caller_index(root, &partials, options)
}

#[test]
fn records_every_call_site_and_the_locals_it_passes() {
  let root = project(
    "call-sites",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      ("app/views/posts/index.html.erb", "<%= render \"posts/card\", title: \"a\" %>\n"),
      ("app/views/home/show.html.erb", "<%= render \"posts/card\", title: \"b\", footer: \"c\" %>\n"),
    ],
  );

  let callers = index(&root, &PartialCallerIndexOptions::default());
  let call_sites = callers.callers_of("app/views/posts/_card.html.erb");

  assert_eq!(call_sites.len(), 2);
  assert_eq!(call_sites[0].caller, "app/views/home/show.html.erb");
  assert_eq!(call_sites[0].locals, vec!["title", "footer"]);
  assert_eq!(call_sites[1].caller, "app/views/posts/index.html.erb");
  assert_eq!(call_sites[1].locals, vec!["title"]);
}

#[test]
fn infers_a_signature_from_the_union_of_the_locals() {
  let root = project(
    "signature",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      ("app/views/posts/index.html.erb", "<%= render \"posts/card\", title: \"a\" %>\n"),
      ("app/views/home/show.html.erb", "<%= render \"posts/card\", title: \"b\", footer: \"c\" %>\n"),
    ],
  );

  let signature = index(&root, &PartialCallerIndexOptions::default()).infer_signature("app/views/posts/_card.html.erb");

  assert_eq!(signature.call_site_count, 2);
  assert_eq!(
    signature.locals.iter().map(|local| local.name.as_str()).collect::<Vec<_>>(),
    vec!["footer", "title"]
  );
  assert!(signature.locals.iter().all(|local| !local.required));
  assert_eq!(strict_locals_declaration(&signature), "<%# locals: (footer: nil, title: nil) %>");
}

#[test]
fn a_render_it_cannot_resolve_leaves_the_index_incomplete() {
  let root = project(
    "unresolved",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      (
        "app/views/posts/index.html.erb",
        "<%= render \"posts/card\", title: \"a\" %>\n<%= render some_variable %>\n",
      ),
    ],
  );

  let callers = index(&root, &PartialCallerIndexOptions::default());

  assert_eq!(callers.unresolved_renders, 1);
  assert!(!callers.is_complete());
  let signature = callers.infer_signature("app/views/posts/_card.html.erb");

  assert!(signature.keyword_rest);
  assert_eq!(strict_locals_declaration(&signature), "<%# locals: (title: nil, **) %>");
}

#[test]
fn an_index_with_nothing_unresolved_is_complete() {
  let root = project(
    "complete",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      ("app/views/posts/index.html.erb", "<%= render \"posts/card\", title: \"a\" %>\n"),
    ],
  );

  let callers = index(&root, &PartialCallerIndexOptions::default());

  assert_eq!(callers.unresolved_renders, 0);
  assert_eq!(callers.skipped_files, 0);
  assert!(callers.is_complete());
  assert!(!callers.infer_signature("app/views/posts/_card.html.erb").keyword_rest);
}

#[test]
fn an_excluded_template_is_skipped_rather_than_read() {
  let root = project(
    "excluded",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      ("app/views/posts/index.html.erb", "<%= render \"posts/card\", title: \"a\" %>\n"),
    ],
  );

  let options = PartialCallerIndexOptions {
    exclude: vec!["**/posts/index.html.erb".to_string()],
    ..Default::default()
  };

  let callers = index(&root, &options);

  assert_eq!(callers.skipped_files, 1);
  assert!(callers.callers_of("app/views/posts/_card.html.erb").is_empty());
  assert!(!callers.is_complete());
}

#[test]
fn a_template_without_the_word_render_is_never_parsed() {
  let root = project(
    "no-render",
    &[
      ("app/views/posts/_card.html.erb", "<div><%= title %></div>\n"),
      ("app/views/posts/index.html.erb", "<div>nothing here</div>\n"),
    ],
  );

  let callers = index(&root, &PartialCallerIndexOptions::default());

  assert!(callers.is_empty());
  assert_eq!(callers.unresolved_renders, 0);
}
