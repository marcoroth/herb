use std::fs;

use herb_config::{add_herb_extension_recommendation, get_extensions_json_relative_path};

#[test]
fn add_herb_extension_recommendation_creates_extensions_json_when_missing() {
  let dir = tempfile::tempdir().unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));

  let contents = fs::read_to_string(dir.path().join(get_extensions_json_relative_path())).unwrap();

  assert!(contents.contains("marcoroth.herb-lsp"));
}

#[test]
fn add_herb_extension_recommendation_does_not_add_a_duplicate() {
  let dir = tempfile::tempdir().unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));
  assert!(!add_herb_extension_recommendation(dir.path()));

  let contents = fs::read_to_string(dir.path().join(get_extensions_json_relative_path())).unwrap();

  assert_eq!(contents.matches("marcoroth.herb-lsp").count(), 1);
}

#[test]
fn add_herb_extension_recommendation_preserves_existing_recommendations() {
  let dir = tempfile::tempdir().unwrap();
  let vscode = dir.path().join(".vscode");

  fs::create_dir_all(&vscode).unwrap();
  fs::write(vscode.join("extensions.json"), "{\n  \"recommendations\": [\"foo.bar\"]\n}\n").unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));

  let contents = fs::read_to_string(vscode.join("extensions.json")).unwrap();

  assert!(contents.contains("foo.bar"));
  assert!(contents.contains("marcoroth.herb-lsp"));
}

#[test]
fn get_extensions_json_relative_path_matches_the_javascript_value() {
  assert_eq!(get_extensions_json_relative_path().to_string_lossy(), ".vscode/extensions.json");
}

#[test]
fn add_herb_extension_recommendation_creates_the_vscode_directory() {
  let dir = tempfile::tempdir().unwrap();

  assert!(!dir.path().join(".vscode").exists());
  assert!(add_herb_extension_recommendation(dir.path()));
  assert!(dir.path().join(".vscode").is_dir());
}

#[test]
fn add_herb_extension_recommendation_handles_an_empty_recommendations_array() {
  let dir = tempfile::tempdir().unwrap();
  let vscode = dir.path().join(".vscode");

  fs::create_dir_all(&vscode).unwrap();
  fs::write(vscode.join("extensions.json"), "{\n  \"recommendations\": []\n}\n").unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));
  assert!(fs::read_to_string(vscode.join("extensions.json")).unwrap().contains("marcoroth.herb-lsp"));
}

#[test]
fn add_herb_extension_recommendation_handles_a_missing_recommendations_property() {
  let dir = tempfile::tempdir().unwrap();
  let vscode = dir.path().join(".vscode");

  fs::create_dir_all(&vscode).unwrap();
  fs::write(vscode.join("extensions.json"), "{}\n").unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));
  assert!(fs::read_to_string(vscode.join("extensions.json")).unwrap().contains("marcoroth.herb-lsp"));
}

#[test]
fn add_herb_extension_recommendation_handles_invalid_json() {
  let dir = tempfile::tempdir().unwrap();
  let vscode = dir.path().join(".vscode");

  fs::create_dir_all(&vscode).unwrap();
  fs::write(vscode.join("extensions.json"), "{ not json").unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));
  assert!(fs::read_to_string(vscode.join("extensions.json")).unwrap().contains("marcoroth.herb-lsp"));
}

#[test]
fn add_herb_extension_recommendation_preserves_unwanted_recommendations() {
  let dir = tempfile::tempdir().unwrap();
  let vscode = dir.path().join(".vscode");

  fs::create_dir_all(&vscode).unwrap();
  fs::write(vscode.join("extensions.json"), "{\n  \"unwantedRecommendations\": [\"bad.ext\"]\n}\n").unwrap();

  assert!(add_herb_extension_recommendation(dir.path()));

  let contents = fs::read_to_string(vscode.join("extensions.json")).unwrap();

  assert!(contents.contains("bad.ext"));
  assert!(contents.contains("marcoroth.herb-lsp"));
}

#[test]
fn extensions_json_is_formatted_with_two_spaces_and_a_trailing_newline() {
  let dir = tempfile::tempdir().unwrap();

  add_herb_extension_recommendation(dir.path());

  let contents = fs::read_to_string(dir.path().join(".vscode").join("extensions.json")).unwrap();

  assert!(contents.contains("\n  \""));
  assert!(contents.ends_with("\n"));
}
