use std::path::Path;
use herb_analysis::rails;

fn app() -> &'static Path {
  Path::new("tests/fixtures/rails_app")
}

#[test]
fn resolves_all_three_lockfile_source_types() {
  let gems = rails::gem_paths(app());
  let joined = gems.paths.join("\n");

  assert!(joined.contains("gems/fakegem-1.2.3/lib"), "registry gem: {joined}");
  assert!(joined.contains("fakerepo-abc123456789/fakemono/lib"), "git monorepo gem: {joined}");
  assert!(joined.contains("local_engine/lib"), "path source: {joined}");
  assert_eq!(gems.resolved, 3);
}

#[test]
fn reports_locked_gems_that_are_not_installed() {
  let gems = rails::gem_paths(app());

  assert_eq!(gems.missing, vec!["notinstalledgem".to_string()]);
}

#[test]
fn indexes_only_lib_and_app_never_the_gem_root() {
  let gems = rails::gem_paths(app());

  assert!(
    gems.paths.iter().all(|path| path.ends_with("/lib") || path.ends_with("/app")),
    "every indexed path should be a lib/ or app/ dir: {:?}",
    gems.paths
  );
  assert!(!gems.paths.iter().any(|path| path.contains("/test")), "must not index a gem's test tree");
}

#[test]
fn dependency_lines_are_not_mistaken_for_specs() {
  let gems = rails::gem_paths(app());

  assert!(!gems.missing.iter().any(|name| name == "somedep" || name == "othergem"), "{:?}", gems.missing);
}

#[test]
fn missing_lockfile_yields_nothing_rather_than_panicking() {
  let gems = rails::gem_paths(Path::new("tests/fixtures/ruby"));

  assert!(gems.paths.is_empty());
  assert_eq!(gems.resolved, 0);
}

#[test]
fn derives_root_and_literal_path_helpers() {
  let routes = rails::route_helpers(app());

  assert!(routes.contains("root_path"));
  assert!(routes.contains("root_url"));
  assert!(routes.contains("about_path"));
  assert!(routes.contains("about_url"));
}

#[test]
fn derives_plural_and_singular_resource_helpers() {
  let routes = rails::route_helpers(app());

  for name in ["posts_path", "post_path", "new_post_path", "edit_post_path"] {
    assert!(routes.contains(name), "missing {name}");
  }

  for name in ["categories_path", "category_path", "new_category_path", "edit_category_path"] {
    assert!(routes.contains(name), "missing {name}");
  }
}

#[test]
fn singular_resource_has_no_plural_index_helper() {
  let routes = rails::route_helpers(app());

  assert!(routes.contains("session_path"));
  assert!(routes.contains("new_session_path"));
  assert!(!routes.contains("sessions_path"), "`resource :session` is singular");
}

#[test]
fn explicit_as_replaces_the_literal_derived_name() {
  let routes = rails::route_helpers(app());

  assert!(routes.contains("reach_us_path"));
  assert!(!routes.contains("contact_path"), "`as:` overrides the path-derived name");
}

#[test]
fn namespaced_resources_use_rails_helper_ordering() {
  let routes = rails::route_helpers(app());

  assert!(routes.contains("admin_users_path"));
  assert!(routes.contains("admin_user_path"));
  assert!(routes.contains("new_admin_user_path"));
  assert!(routes.contains("edit_admin_user_path"));
  assert!(!routes.contains("admin_new_user_path"), "prefix ordering is new_<namespace>_<resource>");
}

#[test]
fn ignores_comments_and_parameterised_paths() {
  let routes = rails::route_helpers(app());

  assert!(!routes.iter().any(|name| name.contains("comment")));
  assert!(
    !routes.iter().any(|name| name.starts_with("preview")),
    "paths with :params are not conventional"
  );
}

#[test]
fn namespace_does_not_leak_past_its_end() {
  let routes = rails::route_helpers(app());

  assert!(routes.contains("posts_path"));
  assert!(!routes.contains("admin_posts_path"));
}

#[test]
fn missing_routes_file_yields_nothing_rather_than_panicking() {
  assert!(rails::route_helpers(Path::new("tests/fixtures/ruby")).is_empty());
}
