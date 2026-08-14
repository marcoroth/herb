use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn binary() -> PathBuf {
  PathBuf::from(env!("CARGO_BIN_EXE_herb-analysis"))
}

fn scratch(name: &str) -> PathBuf {
  let root = std::env::temp_dir().join(format!("herb-object-render-{name}"));

  let _ = fs::remove_dir_all(&root);

  root
}

fn write(root: &PathBuf, relative: &str, body: &str) {
  let path = root.join(relative);

  fs::create_dir_all(path.parent().unwrap()).unwrap();
  fs::write(path, body).unwrap();
}

fn check(root: &PathBuf) -> String {
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
