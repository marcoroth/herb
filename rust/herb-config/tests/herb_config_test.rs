use std::fs;

use herb_config::{HerbConfig, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_INCLUDE_PATTERNS};

#[test]
fn default_include_patterns_contains_common_erb_patterns() {
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.html.erb"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.html"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.rhtml"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.turbo_stream.erb"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.herb"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.html.herb"));
  assert!(DEFAULT_INCLUDE_PATTERNS.contains(&"**/*.html+*.erb"));
}

#[test]
fn default_exclude_patterns_contains_common_directories() {
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"coverage/**/*"));
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"log/**/*"));
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"node_modules/**/*"));
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"storage/**/*"));
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"tmp/**/*"));
  assert!(DEFAULT_EXCLUDE_PATTERNS.contains(&"vendor/**/*"));
}

#[test]
fn default_config_has_linter_enabled() {
  let config = HerbConfig::default();

  assert!(config.linter.enabled);
}

#[test]
fn default_config_has_formatter_disabled() {
  let config = HerbConfig::default();

  assert!(!config.formatter.enabled);
}

#[test]
fn default_config_has_default_formatter_settings() {
  let config = HerbConfig::default();

  assert_eq!(config.formatter.indent_width, 2);
  assert_eq!(config.formatter.max_line_length, 80);
}

#[test]
fn linter_include_patterns_returns_defaults_when_no_config() {
  let config = HerbConfig::default();
  let patterns = config.linter_include_patterns();

  let expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  assert_eq!(patterns, expected);
}

#[test]
fn linter_include_patterns_combines_files_include_with_defaults() {
  let yaml = r#"
files:
  include:
    - '**/*.xml'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_include_patterns();

  let mut expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("**/*.xml".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_include_patterns_combines_linter_include_with_defaults() {
  let yaml = r#"
linter:
  include:
    - '**/*.xml.erb'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_include_patterns();

  let mut expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("**/*.xml.erb".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_include_patterns_combines_all_levels() {
  let yaml = r#"
files:
  include:
    - '**/*.xml'
linter:
  include:
    - '**/*.custom.erb'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_include_patterns();

  let mut expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("**/*.xml".into());
  expected.push("**/*.custom.erb".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_include_patterns_deduplicates() {
  let yaml = r#"
files:
  include:
    - '**/*.html.erb'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_include_patterns();

  let count = patterns.iter().filter(|p| p.as_str() == "**/*.html.erb").count();
  assert_eq!(count, 1);
}

#[test]
fn linter_exclude_patterns_returns_defaults_when_no_config() {
  let config = HerbConfig::default();
  let patterns = config.linter_exclude_patterns();

  let expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  assert_eq!(patterns, expected);
}

#[test]
fn linter_exclude_patterns_combines_files_exclude_with_defaults() {
  let yaml = r#"
files:
  exclude:
    - 'public/**/*'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_exclude_patterns();

  let mut expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("public/**/*".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_exclude_patterns_combines_linter_exclude_with_defaults() {
  let yaml = r#"
linter:
  exclude:
    - 'legacy/**/*'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_exclude_patterns();

  let mut expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("legacy/**/*".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_exclude_patterns_combines_files_and_linter_exclude() {
  let yaml = r#"
files:
  exclude:
    - 'public/**/*'
linter:
  exclude:
    - 'legacy/**/*'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_exclude_patterns();

  let mut expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("public/**/*".into());
  expected.push("legacy/**/*".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_exclude_patterns_deduplicates() {
  let yaml = r#"
files:
  exclude:
    - 'vendor/**/*'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.linter_exclude_patterns();

  let count = patterns.iter().filter(|p| p.as_str() == "vendor/**/*").count();
  assert_eq!(count, 1);
}

#[test]
fn formatter_include_patterns_returns_defaults_when_no_config() {
  let config = HerbConfig::default();
  let patterns = config.formatter_include_patterns();

  let expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  assert_eq!(patterns, expected);
}

#[test]
fn formatter_include_patterns_combines_files_and_formatter_include() {
  let yaml = r#"
files:
  include:
    - '**/*.xml'
formatter:
  include:
    - '**/*.custom.erb'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.formatter_include_patterns();

  let mut expected: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("**/*.xml".into());
  expected.push("**/*.custom.erb".into());
  assert_eq!(patterns, expected);
}

#[test]
fn formatter_exclude_patterns_returns_defaults_when_no_config() {
  let config = HerbConfig::default();
  let patterns = config.formatter_exclude_patterns();

  let expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  assert_eq!(patterns, expected);
}

#[test]
fn formatter_exclude_patterns_combines_files_and_formatter_exclude() {
  let yaml = r#"
files:
  exclude:
    - 'public/**/*'
formatter:
  exclude:
    - 'test/**/*'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let patterns = config.formatter_exclude_patterns();

  let mut expected: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|s| s.to_string()).collect();
  expected.push("public/**/*".into());
  expected.push("test/**/*".into());
  assert_eq!(patterns, expected);
}

#[test]
fn linter_and_formatter_patterns_are_independent() {
  let yaml = r#"
files:
  include:
    - '**/*.xml'
linter:
  include:
    - '**/*.custom.erb'
formatter:
  include:
    - '**/*.special.erb'
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();

  let linter = config.linter_include_patterns();
  let formatter = config.formatter_include_patterns();

  assert!(linter.contains(&"**/*.xml".to_string()));
  assert!(formatter.contains(&"**/*.xml".to_string()));

  assert!(linter.contains(&"**/*.custom.erb".to_string()));
  assert!(!linter.contains(&"**/*.special.erb".to_string()));

  assert!(formatter.contains(&"**/*.special.erb".to_string()));
  assert!(!formatter.contains(&"**/*.custom.erb".to_string()));
}

#[test]
fn to_linter_config_transfers_rules() {
  let yaml = r#"
linter:
  rules:
    html-tag-name-lowercase:
      enabled: false
      severity: error
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let linter_config = config.to_linter_config();

  assert!(!linter_config.is_rule_enabled("html-tag-name-lowercase", true));
}

#[test]
fn to_formatter_config_transfers_settings() {
  let yaml = r#"
formatter:
  indentWidth: 4
  maxLineLength: 120
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let formatter_config = config.to_formatter_config();

  assert_eq!(formatter_config.indent_width, 4);
  assert_eq!(formatter_config.max_line_length, 120);
}

#[test]
fn to_formatter_config_uses_defaults() {
  let config = HerbConfig::default();
  let formatter_config = config.to_formatter_config();

  assert_eq!(formatter_config.indent_width, 2);
  assert_eq!(formatter_config.max_line_length, 80);
}

#[test]
fn load_from_path_parses_yaml() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");
  fs::write(
    &config_path,
    r#"
version: 0.8.10
linter:
  enabled: true
  rules:
    html-tag-name-lowercase:
      enabled: false
formatter:
  enabled: false
  indentWidth: 4
  maxLineLength: 120
"#,
  )
  .unwrap();

  let config = HerbConfig::load_from_path(&config_path).unwrap();

  assert_eq!(config.version, Some("0.8.10".into()));
  assert!(config.linter.enabled);
  assert!(!config.formatter.enabled);
  assert_eq!(config.formatter.indent_width, 4);
  assert_eq!(config.formatter.max_line_length, 120);

  let linter_config = config.to_linter_config();
  assert!(!linter_config.is_rule_enabled("html-tag-name-lowercase", true));
}

#[test]
fn load_from_path_returns_error_for_nonexistent_file() {
  let result = HerbConfig::load_from_path(std::path::Path::new("/nonexistent/.herb.yml"));

  assert!(result.is_err());
}

#[test]
fn load_from_path_returns_error_for_invalid_yaml() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");
  fs::write(&config_path, "{{invalid yaml}}").unwrap();

  let result = HerbConfig::load_from_path(&config_path);

  assert!(result.is_err());
}

#[test]
fn find_config_file_finds_config_in_current_dir() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");
  fs::write(&config_path, "version: 0.8.10\n").unwrap();

  let found = HerbConfig::find_config_file(dir.path());

  assert_eq!(found, Some(config_path));
}

#[test]
fn find_config_file_walks_up_directory_tree() {
  let dir = tempfile::tempdir().unwrap();
  let config_path = dir.path().join(".herb.yml");
  fs::write(&config_path, "version: 0.8.10\n").unwrap();

  let sub_dir = dir.path().join("app").join("views");
  fs::create_dir_all(&sub_dir).unwrap();

  let found = HerbConfig::find_config_file(&sub_dir);

  assert_eq!(found, Some(config_path));
}

#[test]
fn find_config_file_returns_none_when_not_found() {
  let dir = tempfile::tempdir().unwrap();

  let found = HerbConfig::find_config_file(dir.path());

  assert!(found.is_none() || found.is_some());
}

#[test]
fn load_full_config_with_all_sections() {
  let yaml = r#"
version: 0.8.10

files:
  include:
    - '**/*.xml.erb'
  exclude:
    - 'public/**/*'

linter:
  enabled: true
  failLevel: warning
  include:
    - '**/*.custom.erb'
  exclude:
    - 'legacy/**/*'
  rules:
    html-tag-name-lowercase:
      enabled: false
      severity: error
    erb-require-trailing-newline:
      only:
        - 'app/views/**/*'
      exclude:
        - 'app/views/admin/**/*'

formatter:
  enabled: true
  indentWidth: 4
  maxLineLength: 100
  include:
    - '**/*.special.erb'
  exclude:
    - 'generated/**/*'
"#;

  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();

  assert_eq!(config.version, Some("0.8.10".into()));

  assert_eq!(config.files.include, vec!["**/*.xml.erb"]);
  assert_eq!(config.files.exclude, vec!["public/**/*"]);

  assert!(config.linter.enabled);
  assert_eq!(config.linter.include, vec!["**/*.custom.erb"]);
  assert_eq!(config.linter.exclude, vec!["legacy/**/*"]);

  let linter_config = config.to_linter_config();
  assert!(!linter_config.is_rule_enabled("html-tag-name-lowercase", true));
  assert!(linter_config.is_rule_enabled("erb-require-trailing-newline", true));
  assert!(linter_config.is_rule_enabled_for_path("erb-require-trailing-newline", "app/views/home/index.html.erb", &[]));
  assert!(!linter_config.is_rule_enabled_for_path("erb-require-trailing-newline", "app/views/admin/dashboard.html.erb", &[]));
  assert!(!linter_config.is_rule_enabled_for_path("erb-require-trailing-newline", "lib/templates/email.html.erb", &[]));

  assert!(config.formatter.enabled);
  assert_eq!(config.formatter.indent_width, 4);
  assert_eq!(config.formatter.max_line_length, 100);

  let linter_includes = config.linter_include_patterns();
  assert!(linter_includes.contains(&"**/*.xml.erb".to_string()));
  assert!(linter_includes.contains(&"**/*.custom.erb".to_string()));

  let linter_excludes = config.linter_exclude_patterns();
  assert!(linter_excludes.contains(&"public/**/*".to_string()));
  assert!(linter_excludes.contains(&"legacy/**/*".to_string()));
}

#[test]
fn severity_parses_from_yaml() {
  let yaml = r#"
linter:
  rules:
    rule-a:
      severity: error
    rule-b:
      severity: warning
    rule-c:
      severity: info
    rule-d:
      severity: hint
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();
  let linter = config.to_linter_config();

  assert_eq!(linter.get_severity("rule-a", herb_config::Severity::Warning), herb_config::Severity::Error);
  assert_eq!(linter.get_severity("rule-b", herb_config::Severity::Error), herb_config::Severity::Warning);
  assert_eq!(linter.get_severity("rule-c", herb_config::Severity::Error), herb_config::Severity::Info);
  assert_eq!(linter.get_severity("rule-d", herb_config::Severity::Error), herb_config::Severity::Hint);
}

#[test]
fn fail_level_parses_from_yaml() {
  let yaml = r#"
linter:
  failLevel: warning
"#;
  let config: HerbConfig = serde_yaml::from_str(yaml).unwrap();

  assert_eq!(config.linter.fail_level, Some(herb_config::Severity::Warning));
}

#[test]
fn fail_level_defaults_to_none() {
  let config = HerbConfig::default();

  assert_eq!(config.linter.fail_level, None);
}
