use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::formatter_config::{default_indent_width, default_max_line_length};
use crate::rule_config::default_enabled;
use crate::{FormatterConfig, LinterConfig, RuleConfig, Severity};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FilesConfig {
  #[serde(default)]
  pub include: Vec<String>,
  #[serde(default)]
  pub exclude: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HerbLinterConfig {
  #[serde(default = "default_enabled")]
  pub enabled: bool,
  #[serde(default)]
  pub fail_level: Option<Severity>,
  #[serde(default)]
  pub include: Vec<String>,
  #[serde(default)]
  pub exclude: Vec<String>,
  #[serde(default)]
  pub rules: HashMap<String, RuleConfig>,
}

impl Default for HerbLinterConfig {
  fn default() -> Self {
    Self {
      enabled: true,
      fail_level: None,
      include: Vec::new(),
      exclude: Vec::new(),
      rules: HashMap::new(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HerbFormatterConfig {
  #[serde(default = "default_enabled")]
  pub enabled: bool,
  #[serde(default = "default_indent_width")]
  pub indent_width: usize,
  #[serde(default = "default_max_line_length")]
  pub max_line_length: usize,
  #[serde(default)]
  pub include: Vec<String>,
  #[serde(default)]
  pub exclude: Vec<String>,
}

impl Default for HerbFormatterConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      indent_width: default_indent_width(),
      max_line_length: default_max_line_length(),
      include: Vec::new(),
      exclude: Vec::new(),
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HerbConfig {
  #[serde(default)]
  pub version: Option<String>,
  #[serde(default)]
  pub files: FilesConfig,
  #[serde(default)]
  pub linter: HerbLinterConfig,
  #[serde(default)]
  pub formatter: HerbFormatterConfig,
}

pub const DEFAULT_INCLUDE_PATTERNS: &[&str] = &[
  "**/*.herb",
  "**/*.html.erb",
  "**/*.html.herb",
  "**/*.html",
  "**/*.html+*.erb",
  "**/*.rhtml",
  "**/*.turbo_stream.erb",
];

pub const DEFAULT_EXCLUDE_PATTERNS: &[&str] = &["coverage/**/*", "log/**/*", "node_modules/**/*", "storage/**/*", "tmp/**/*", "vendor/**/*"];

const CONFIG_FILE_NAME: &str = ".herb.yml";
const PROJECT_INDICATORS: &[&str] = &[".git", ".herb", "Gemfile", "package.json", "Rakefile", "README.md"];

impl HerbConfig {
  pub fn load(start_path: &Path, explicit_config_file: Option<&str>) -> (Self, Option<PathBuf>) {
    if let Some(explicit) = explicit_config_file {
      let config_path = Path::new(explicit);

      if !config_path.exists() {
        eprintln!("Error: Configuration file '{}' does not exist", explicit);
        std::process::exit(1);
      }

      match Self::load_from_path(config_path) {
        Ok(config) => return (config, Some(config_path.to_path_buf())),
        Err(error) => {
          eprintln!("Error: Failed to parse configuration file '{}': {}", explicit, error);
          std::process::exit(1);
        }
      }
    }

    if let Some(config_path) = Self::find_config_file(start_path) {
      match Self::load_from_path(&config_path) {
        Ok(config) => return (config, Some(config_path)),
        Err(error) => {
          eprintln!("Error: Failed to parse configuration file '{}': {}", config_path.display(), error);
          std::process::exit(1);
        }
      }
    }

    (Self::default(), None)
  }

  pub fn load_from_path(path: &Path) -> Result<Self, String> {
    let content = std::fs::read_to_string(path).map_err(|error| format!("Failed to read file: {}", error))?;

    serde_yaml::from_str(&content).map_err(|error| format!("Failed to parse YAML: {}", error))
  }

  pub fn find_config_file(start_path: &Path) -> Option<PathBuf> {
    let start = if start_path.is_file() { start_path.parent()? } else { start_path };

    let mut current = start.to_path_buf();

    loop {
      let config_path = current.join(CONFIG_FILE_NAME);
      if config_path.exists() {
        return Some(config_path);
      }

      if !current.pop() {
        break;
      }
    }

    None
  }

  pub fn find_project_root(start_path: &Path) -> PathBuf {
    let start = if start_path.is_file() {
      start_path.parent().unwrap_or(start_path)
    } else {
      start_path
    };

    let mut current = start.to_path_buf();

    loop {
      if current.join(CONFIG_FILE_NAME).exists() {
        return current;
      }

      for indicator in PROJECT_INDICATORS {
        if current.join(indicator).exists() {
          return current;
        }
      }

      if !current.pop() {
        break;
      }
    }

    start.to_path_buf()
  }

  pub fn linter_include_patterns(&self) -> Vec<String> {
    let mut patterns: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|string| string.to_string()).collect();

    for pattern in &self.files.include {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    for pattern in &self.linter.include {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    patterns
  }

  pub fn linter_exclude_patterns(&self) -> Vec<String> {
    let mut patterns: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|string| string.to_string()).collect();

    for pattern in &self.files.exclude {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    for pattern in &self.linter.exclude {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    patterns
  }

  pub fn to_linter_config(&self) -> LinterConfig {
    LinterConfig {
      rules: self.linter.rules.clone(),
    }
  }

  pub fn to_formatter_config(&self) -> FormatterConfig {
    FormatterConfig {
      indent_width: self.formatter.indent_width,
      max_line_length: self.formatter.max_line_length,
    }
  }

  pub fn formatter_include_patterns(&self) -> Vec<String> {
    let mut patterns: Vec<String> = DEFAULT_INCLUDE_PATTERNS.iter().map(|string| string.to_string()).collect();

    for pattern in &self.files.include {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    for pattern in &self.formatter.include {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    patterns
  }

  pub fn formatter_exclude_patterns(&self) -> Vec<String> {
    let mut patterns: Vec<String> = DEFAULT_EXCLUDE_PATTERNS.iter().map(|string| string.to_string()).collect();

    for pattern in &self.files.exclude {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    for pattern in &self.formatter.exclude {
      if !patterns.contains(pattern) {
        patterns.push(pattern.clone());
      }
    }

    patterns
  }

  pub fn default_template() -> &'static str {
    include_str!("../../../javascript/packages/config/src/config-template.yml")
  }
}
