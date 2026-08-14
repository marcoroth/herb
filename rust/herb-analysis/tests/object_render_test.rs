use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn binary() -> PathBuf {
  PathBuf::from(env!("CARGO_BIN_EXE_herb-analysis"))
}

fn scratch(name: &str) -> PathBuf {
  let root = std::env::temp_dir().join(format!("herb-object-render-{name}"));

  let _ = fs::remove_dir_all(&root);

  root
}

fn write(root: &Path, relative: &str, body: &str) {
  let path = root.join(relative);

  fs::create_dir_all(path.parent().unwrap()).unwrap();
  fs::write(path, body).unwrap();
}

fn check(root: &Path) -> String {
  let output = Command::new(binary()).args(["actionview", "check", root.to_str().unwrap()]).output().unwrap();

  String::from_utf8_lossy(&output.stdout).to_string()
}

#[test]
fn a_guessed_object_partial_that_does_not_exist_is_not_an_error() {
  let root = scratch("miss");

  write(&root, "app/views/components/index.html.erb", "<%= render body do %><% end %>\n");

  let output = check(&root);

  assert!(!output.contains("bodys/body"), "a guessed name should not be reported as unresolved:\n{output}");
}

#[test]
fn a_named_partial_that_does_not_exist_is_still_an_error() {
  let root = scratch("named");

  write(&root, "app/views/posts/index.html.erb", "<%= render \"posts/missing\" %>\n");

  let output = check(&root);

  assert!(output.contains("posts/missing"), "an explicit name should still be reported:\n{output}");
}

#[test]
fn a_guessed_object_partial_that_exists_still_resolves() {
  let root = scratch("hit");

  write(&root, "app/views/posts/index.html.erb", "<%= render post %>\n");
  write(&root, "app/views/posts/_post.html.erb", "<div></div>\n");

  let output = check(&root);

  assert!(!output.contains("posts/post"), "an existing guessed target should resolve:\n{output}");
}

#[test]
fn a_dynamic_render_lists_the_partials_under_its_prefix() {
  let root = scratch("dynamic-prefix");

  write(&root, "app/views/admin/show.html.erb", "<%= render \"admin/parts/#{name}\" %>\n");
  write(&root, "app/views/admin/parts/_alpha.html.erb", "<div></div>\n");
  write(&root, "app/views/admin/parts/_beta.html.erb", "<div></div>\n");

  let output = check(&root);

  assert!(output.contains("admin/parts/alpha"), "candidates should be listed:\n{output}");
  assert!(output.contains("admin/parts/beta"), "candidates should be listed:\n{output}");
}

#[test]
fn a_dynamic_render_with_no_known_directory_lists_nothing() {
  let root = scratch("dynamic-bare");

  write(&root, "app/views/admin/show.html.erb", "<%= render \"#{name}\" %>\n");
  write(&root, "app/views/admin/parts/_alpha.html.erb", "<div></div>\n");

  let output = check(&root);

  assert!(!output.contains("admin/parts/alpha"), "nothing should be claimed:\n{output}");
}
