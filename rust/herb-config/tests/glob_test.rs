use herb_config::is_path_matching;

fn glob_match(pattern: &str, path: &str) -> bool {
  is_path_matching(path, &[pattern])
}

#[test]
fn test_double_star_extension() {
  assert!(glob_match("**/*.xml", "file.xml"));
  assert!(glob_match("**/*.xml", "dir/file.xml"));
  assert!(glob_match("**/*.xml", "a/b/c/file.xml"));
  assert!(!glob_match("**/*.xml", "file.rs"));
  assert!(!glob_match("**/*.xml", "file.xml.erb"));
}

#[test]
fn test_double_star_compound_extension() {
  assert!(glob_match("**/*.xml.erb", "file.xml.erb"));
  assert!(glob_match("**/*.xml.erb", "dir/file.xml.erb"));
  assert!(!glob_match("**/*.xml.erb", "file.xml"));
  assert!(!glob_match("**/*.xml.erb", "file.erb"));
}

#[test]
fn test_path_prefix_with_double_star() {
  assert!(glob_match("app/views/**/*", "app/views/home/index.html"));
  assert!(glob_match("app/views/**/*", "app/views/file.erb"));
  assert!(!glob_match("app/views/**/*", "lib/views/file.erb"));
}

#[test]
fn test_single_star() {
  assert!(glob_match("*.xml", "file.xml"));
  assert!(!glob_match("*.xml", "dir/file.xml"));
}

#[test]
fn test_question_mark() {
  assert!(glob_match("file?.xml", "file1.xml"));
  assert!(!glob_match("file?.xml", "file.xml"));
  assert!(!glob_match("file?.xml", "file12.xml"));
}

#[test]
fn test_exact_match() {
  assert!(glob_match("file.xml", "file.xml"));
  assert!(!glob_match("file.xml", "other.xml"));
}

#[test]
fn test_is_path_matching() {
  let patterns = vec!["**/*.xml".to_string(), "**/*.xml.erb".to_string()];
  assert!(is_path_matching("file.xml", &patterns));
  assert!(is_path_matching("dir/file.xml.erb", &patterns));
  assert!(!is_path_matching("file.html", &patterns));
}

#[test]
fn test_empty_patterns() {
  let patterns: Vec<String> = vec![];
  assert!(!is_path_matching("file.xml", &patterns));
}
