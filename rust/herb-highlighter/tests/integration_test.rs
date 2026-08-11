#![cfg(feature = "cli")]

use std::fs;
use std::path::Path;
use std::process::Command;

use herb_highlighter::ansi::find_ansi_sequences;

const TEMPLATE: &str = "<h1 class=\"title\">\n  <% if user.present? %>\n    Welcome <%= user.name %>!\n  <% else %>\n    Please sign in\n  <% end %>\n</h1>";

struct Fixture {
  directory: tempfile::TempDir,
}

impl Fixture {
  fn new() -> Self {
    let directory = tempfile::tempdir().expect("a temporary directory");

    fs::write(directory.path().join("test-template.html.erb"), TEMPLATE).expect("the template is written");

    Self { directory }
  }

  fn path(&self) -> String {
    self.directory.path().join("test-template.html.erb").to_string_lossy().into_owned()
  }

  fn normalize(&self, output: &str) -> String {
    output.replace(&self.path(), "<test-file>")
  }
}

fn run(arguments: &[&str], color: bool) -> std::process::Output {
  let mut command = Command::new(env!("CARGO_BIN_EXE_herb-highlight"));

  command.args(arguments);
  command.current_dir(Path::new(env!("CARGO_MANIFEST_DIR")));

  if color {
    command.env_remove("NO_COLOR");
  } else {
    command.env("NO_COLOR", "1");
  }

  command.output().expect("the CLI runs")
}

#[test]
fn highlights_a_file_via_the_cli() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path()], true);

  assert!(output.status.success());

  insta::assert_snapshot!(fixture.normalize(&String::from_utf8_lossy(&output.stdout)));
}

#[test]
fn handles_a_non_existent_file_gracefully() {
  let output = run(&["non-existent-file.erb"], true);

  assert!(!output.status.success());
  assert!(String::from_utf8_lossy(&output.stderr).contains("File not found: non-existent-file.erb"));
}

#[test]
fn respects_the_no_color_environment_variable() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path()], false);

  let stdout = String::from_utf8_lossy(&output.stdout);

  assert!(find_ansi_sequences(&stdout).is_empty());

  insta::assert_snapshot!(fixture.normalize(&stdout));
}

#[test]
fn supports_the_focus_option() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path(), "--focus", "3"], true);

  assert!(output.status.success());

  insta::assert_snapshot!(fixture.normalize(&String::from_utf8_lossy(&output.stdout)));
}

#[test]
fn supports_the_context_lines_option() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path(), "--focus", "3", "--context-lines", "1"], true);

  assert!(output.status.success());

  insta::assert_snapshot!(fixture.normalize(&String::from_utf8_lossy(&output.stdout)));
}

#[test]
fn handles_an_invalid_focus_value() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path(), "--focus", "abc"], true);

  assert!(!output.status.success());
  assert!(String::from_utf8_lossy(&output.stderr).contains("Invalid focus line"));
}

#[test]
fn requires_diagnostics_for_split_diagnostics() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path(), "--split-diagnostics"], true);

  assert!(!output.status.success());
  assert!(String::from_utf8_lossy(&output.stderr).contains("--split-diagnostics requires --diagnostics"));
}

#[test]
fn renders_diagnostics_passed_as_json() {
  let fixture = Fixture::new();

  let diagnostics =
    r#"[{"message":"Test offense","severity":"error","code":"test-rule","location":{"start":{"line":1,"column":4},"end":{"line":1,"column":9}}}]"#;

  let output = run(&[&fixture.path(), "--diagnostics", diagnostics], false);

  assert!(output.status.success());

  insta::assert_snapshot!(fixture.normalize(&String::from_utf8_lossy(&output.stdout)));
}

#[test]
fn rejects_diagnostics_that_are_missing_required_fields() {
  let fixture = Fixture::new();
  let output = run(&[&fixture.path(), "--diagnostics", r#"{"message":"no location"}"#], true);

  assert!(!output.status.success());
  assert!(String::from_utf8_lossy(&output.stderr).contains("each diagnostic must have message, location, and severity"));
}

#[test]
fn diffs_two_files_via_the_diff_subcommand() {
  let directory = tempfile::tempdir().expect("a temporary directory");

  let before = directory.path().join("before.html.erb");
  let after = directory.path().join("after.html.erb");

  fs::write(&before, "<div>\n  <span class='card'>x</span>\n</div>").expect("the file is written");
  fs::write(&after, "<div>\n  <span class=\"card\">x</span>\n</div>").expect("the file is written");

  let output = run(&["diff", &before.to_string_lossy(), &after.to_string_lossy()], false);

  assert!(output.status.success());

  let stdout = String::from_utf8_lossy(&output.stdout)
    .replace(&*before.to_string_lossy(), "<before>")
    .replace(&*after.to_string_lossy(), "<after>");

  insta::assert_snapshot!(stdout);
}

#[test]
fn renders_a_diff_given_as_json() {
  let output = run(
    &["diff", r#"{"original": "<img src=\"a.png\">", "modified": "<img src=\"a.png\" alt=\"\">"}"#],
    false,
  );

  assert!(output.status.success());

  insta::assert_snapshot!(String::from_utf8_lossy(&output.stdout));
}

#[test]
fn renders_a_unified_diff_given_as_a_file() {
  let directory = tempfile::tempdir().expect("a temporary directory");
  let patch = directory.path().join("fix.patch");

  fs::write(
    &patch,
    "--- a/app/views/gems/index.html.erb\n+++ b/app/views/gems/index.html.erb\n@@ -1,3 +1,3 @@\n <div id=\"gems\">\n-  <span class='card'>x</span>\n+  <span class=\"card\">x</span>\n </div>\n",
  )
  .expect("the patch is written");

  let output = run(&["diff", &patch.to_string_lossy()], false);

  assert!(output.status.success());

  insta::assert_snapshot!(String::from_utf8_lossy(&output.stdout));
}

#[test]
fn shows_the_usage_for_help() {
  let output = run(&["--help"], false);

  assert!(output.status.success());

  insta::assert_snapshot!(String::from_utf8_lossy(&output.stdout));
}

#[test]
fn shows_the_versions() {
  let output = run(&["--version"], false);

  assert!(output.status.success());

  let stdout = String::from_utf8_lossy(&output.stdout);

  assert!(stdout.starts_with("Versions:\n"));
  assert!(stdout.contains(&format!("herb-highlighter@{}", env!("CARGO_PKG_VERSION"))));
}

#[test]
fn requires_an_input_file() {
  let output = run(&[], false);

  assert!(!output.status.success());
  assert!(String::from_utf8_lossy(&output.stderr).contains("Please specify an input file."));
}
