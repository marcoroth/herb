use std::path::{Path, PathBuf};

use crate::config_schema::{FilesConfig, FormatterConfig, HerbConfig, HerbConfigOptions, LinterConfig, RuleConfig};
use crate::defaults::{config_template, default_config, default_config_value, DEFAULT_VERSION};
use crate::glob::{glob, glob_absolute, is_path_matching};
use crate::merge::deep_merge;
use crate::semver::semver_greater_than;
use crate::severity::{resolve_severity, LinterMode, Severity, SeverityConfig};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tool {
  Linter,
  Formatter,
}

pub trait SeverityOverridable {
  fn rule(&self) -> &str;
  fn set_severity(&mut self, severity: Severity);
}

pub const CONFIG_PATH: &str = ".herb.yml";
pub const ALL_RULES_KEY: &str = "all";

const PROJECT_INDICATORS: &[&str] = &[
  ".git",
  ".herb",
  ".herb.yml",
  "Gemfile",
  "package.json",
  "Rakefile",
  "README.md",
  "*.gemspec",
  "config/application.rb",
];

#[derive(Debug, Clone, Default)]
pub struct LoadOptions<'options> {
  pub silent: bool,
  pub version: Option<&'options str>,
  pub create_if_missing: bool,
  pub exit_on_error: bool,
}

#[derive(Debug, Clone, Default)]
pub struct FromObjectOptions<'options> {
  pub project_path: Option<&'options Path>,
  pub version: Option<&'options str>,
  pub config_version: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
  pub path: PathBuf,
  pub config: HerbConfig,
  pub config_version: Option<String>,
}

impl Default for Config {
  fn default() -> Self {
    Self::new(Path::new("."), default_config(DEFAULT_VERSION), None)
  }
}

impl Config {
  pub fn new(project_path: &Path, config: HerbConfig, config_version: Option<String>) -> Self {
    Self {
      path: Self::config_path_from_project_path(project_path),
      config,
      config_version,
    }
  }

  pub fn project_path(&self) -> &Path {
    self.path.parent().unwrap_or(Path::new("."))
  }

  pub fn version(&self) -> &str {
    &self.config.version
  }

  pub fn options(&self) -> HerbConfigOptions {
    HerbConfigOptions {
      files: self.config.files.clone(),
      engine: None,
      linter: self.config.linter.clone(),
      formatter: self.config.formatter.clone(),
    }
  }

  pub fn linter(&self) -> Option<&LinterConfig> {
    self.config.linter.as_ref()
  }

  pub fn formatter(&self) -> Option<&FormatterConfig> {
    self.config.formatter.as_ref()
  }

  pub fn to_json(&self) -> String {
    serde_json::to_string_pretty(&self.config).unwrap_or_else(|_| "{}".to_string())
  }

  pub fn is_linter_enabled(&self) -> bool {
    self
      .linter()
      .and_then(|linter| linter.enabled)
      .or_else(|| Self::get_default_config(DEFAULT_VERSION).linter.and_then(|linter| linter.enabled))
      .unwrap_or(true)
  }

  pub fn is_formatter_enabled(&self) -> bool {
    self
      .formatter()
      .and_then(|formatter| formatter.enabled)
      .or_else(|| Self::get_default_config(DEFAULT_VERSION).formatter.and_then(|formatter| formatter.enabled))
      .unwrap_or(false)
  }

  pub fn get_rule_config(&self, rule_name: &str) -> Option<&RuleConfig> {
    self.linter()?.rules.as_ref()?.get(rule_name)
  }

  pub fn default_rule_enabled(&self) -> Option<bool> {
    self.get_rule_config(ALL_RULES_KEY).and_then(|rule| rule.enabled)
  }

  pub fn is_rule_disabled(&self, rule_name: &str) -> bool {
    match self.get_rule_config(rule_name) {
      Some(rule) => rule.enabled == Some(false),
      None => self.default_rule_enabled() == Some(false),
    }
  }

  pub fn is_rule_enabled(&self, rule_name: &str) -> bool {
    !self.is_rule_disabled(rule_name)
  }

  pub fn get_files_config_for_tool(&self, tool: Tool) -> FilesConfig {
    let (tool_include, tool_exclude) = match tool {
      Tool::Linter => (
        self.linter().and_then(|linter| linter.include.clone()),
        self.linter().and_then(|linter| linter.exclude.clone()),
      ),

      Tool::Formatter => (
        self.formatter().and_then(|formatter| formatter.include.clone()),
        self.formatter().and_then(|formatter| formatter.exclude.clone()),
      ),
    };

    let top_level_files = self.config.files.clone().unwrap_or_default();

    let mut include = top_level_files.include.unwrap_or_default();
    include.extend(tool_include.unwrap_or_default());

    let mut exclude = top_level_files.exclude.unwrap_or_default();
    exclude.extend(tool_exclude.unwrap_or_default());

    FilesConfig {
      include: Some(include),
      exclude: Some(exclude),
    }
  }

  pub fn files_config_for_linter(&self) -> FilesConfig {
    self.get_files_config_for_tool(Tool::Linter)
  }

  pub fn files_config_for_formatter(&self) -> FilesConfig {
    self.get_files_config_for_tool(Tool::Formatter)
  }

  pub fn find_files_for_tool(&self, tool: Tool, cwd: Option<&Path>) -> Vec<String> {
    let search_directory = cwd.map(Path::to_path_buf).unwrap_or_else(|| self.project_path().to_path_buf());
    let files_config = self.get_files_config_for_tool(tool);

    let patterns = files_config.include.unwrap_or_default();

    if patterns.is_empty() {
      return Vec::new();
    }

    glob_absolute(&patterns, &search_directory, &files_config.exclude.unwrap_or_default())
  }

  pub fn find_files_for_linter(&self, cwd: Option<&Path>) -> Vec<String> {
    self.find_files_for_tool(Tool::Linter, cwd)
  }

  pub fn find_files_for_formatter(&self, cwd: Option<&Path>) -> Vec<String> {
    self.find_files_for_tool(Tool::Formatter, cwd)
  }

  pub fn glob_files(&self, patterns: &[String], cwd: &Path, ignore: &[String]) -> Vec<String> {
    glob(patterns, cwd, ignore)
  }

  fn normalize_file_path(&self, file_path: &str) -> String {
    let path = Path::new(file_path);

    if path.is_absolute() {
      let project_directory = format!("{}{}", self.project_path().to_string_lossy(), std::path::MAIN_SEPARATOR);

      if let Some(stripped) = file_path.strip_prefix(&project_directory) {
        return stripped.to_string();
      }
    }

    file_path.to_string()
  }

  fn is_path_excluded(&self, file_path: &str, exclude_patterns: &[String]) -> bool {
    if exclude_patterns.is_empty() {
      return false;
    }

    is_path_matching(&self.normalize_file_path(file_path), exclude_patterns)
  }

  fn is_path_included(&self, file_path: &str, include_patterns: &[String]) -> bool {
    if include_patterns.is_empty() {
      return true;
    }

    is_path_matching(&self.normalize_file_path(file_path), include_patterns)
  }

  pub fn is_enabled_for_path(&self, file_path: &str, tool: Tool) -> bool {
    let is_enabled = match tool {
      Tool::Linter => self.is_linter_enabled(),
      Tool::Formatter => self.is_formatter_enabled(),
    };

    if !is_enabled {
      return false;
    }

    let files_config = self.get_files_config_for_tool(tool);
    let exclude_patterns = files_config.exclude.unwrap_or_default();

    !self.is_path_excluded(file_path, &exclude_patterns)
  }

  pub fn is_linter_enabled_for_path(&self, file_path: &str) -> bool {
    self.is_enabled_for_path(file_path, Tool::Linter)
  }

  pub fn is_formatter_enabled_for_path(&self, file_path: &str) -> bool {
    self.is_enabled_for_path(file_path, Tool::Formatter)
  }

  pub fn is_rule_enabled_for_path(&self, rule_name: &str, file_path: &str) -> bool {
    if !self.is_linter_enabled() {
      return false;
    }

    if self.is_rule_disabled(rule_name) {
      return false;
    }

    let rule_config = self.get_rule_config(rule_name);
    let rule_only_patterns = rule_config.and_then(|rule| rule.only.clone()).unwrap_or_default();
    let rule_include_patterns = rule_config.and_then(|rule| rule.include.clone()).unwrap_or_default();
    let rule_exclude_patterns = rule_config.and_then(|rule| rule.exclude.clone()).unwrap_or_default();

    let mut bypass_parent_excludes = false;

    if !rule_only_patterns.is_empty() {
      if self.is_path_included(file_path, &rule_only_patterns) {
        bypass_parent_excludes = true;
      } else {
        return false;
      }
    } else if !rule_include_patterns.is_empty() {
      if self.is_path_included(file_path, &rule_include_patterns) {
        bypass_parent_excludes = true;
      } else {
        return false;
      }
    }

    if !bypass_parent_excludes && !self.is_linter_enabled_for_path(file_path) {
      return false;
    }

    !self.is_path_excluded(file_path, &rule_exclude_patterns)
  }

  pub fn has_rule_exclude(&self, rule_name: &str) -> bool {
    self.get_rule_config(rule_name).and_then(|rule| rule.exclude.as_ref()).is_some()
  }

  pub fn get_configured_severity(&self, rule_name: &str, default_severity: SeverityConfig, mode: LinterMode) -> Severity {
    let severity = self.get_rule_config(rule_name).and_then(|rule| rule.severity).unwrap_or(default_severity);

    resolve_severity(severity, mode)
  }

  pub fn apply_severity_overrides<T: SeverityOverridable>(&self, offenses: &mut [T], mode: LinterMode) {
    if self.linter().and_then(|linter| linter.rules.as_ref()).is_none() {
      return;
    }

    for offense in offenses {
      if let Some(severity) = self.get_rule_config(offense.rule()).and_then(|rule| rule.severity) {
        offense.set_severity(resolve_severity(severity, mode));
      }
    }
  }

  pub fn config_path_from_project_path(project_path: &Path) -> PathBuf {
    project_path.join(CONFIG_PATH)
  }

  pub fn get_default_file_patterns() -> Vec<String> {
    Self::get_default_config(DEFAULT_VERSION)
      .files
      .and_then(|files| files.include)
      .unwrap_or_default()
  }

  pub fn exists(path_or_file: &Path) -> bool {
    let config_path = if path_or_file.ends_with(CONFIG_PATH) {
      path_or_file.to_path_buf()
    } else {
      Self::config_path_from_project_path(path_or_file)
    };

    config_path.exists()
  }

  pub fn find_project_root(start_path: &Path) -> PathBuf {
    Self::find_config_file(start_path).project_root
  }

  pub fn find_project_root_sync(start_path: &Path) -> PathBuf {
    Self::find_project_root(start_path)
  }

  pub fn load_for_editor(path_or_file: &Path, version: Option<&str>) -> Result<Self, String> {
    Self::load_with_options(
      path_or_file,
      &LoadOptions {
        silent: true,
        version,
        create_if_missing: false,
        exit_on_error: false,
      },
    )
  }

  pub fn load_for_cli(path_or_file: &Path, version: Option<&str>, create_if_missing: bool) -> Result<Self, String> {
    Self::load_with_options(
      path_or_file,
      &LoadOptions {
        silent: false,
        version,
        create_if_missing,
        exit_on_error: false,
      },
    )
  }

  pub fn load_with_options(path_or_file: &Path, options: &LoadOptions) -> Result<Self, String> {
    let version = options.version.unwrap_or(DEFAULT_VERSION);

    if path_or_file.ends_with(CONFIG_PATH) {
      return Self::load_from_explicit_path(path_or_file, version);
    }

    let FoundConfigFile { config_path, project_root } = Self::find_config_file(path_or_file);

    if let Some(config_path) = config_path {
      let config = Self::load_from_path(&config_path, &project_root, version)?;

      if !options.silent {
        eprintln!("\u{2713} Using Herb config file at {}", config_path.display());
      }

      return Ok(config);
    }

    if options.create_if_missing {
      return Self::create_default_config(&project_root, options.silent, version);
    }

    Ok(Self::new(&project_root, Self::get_default_config(version), None))
  }

  pub fn read_raw_yaml(path_or_file: &Path) -> Result<String, String> {
    let config_path = if path_or_file.ends_with(CONFIG_PATH) {
      path_or_file.to_path_buf()
    } else {
      Self::config_path_from_project_path(path_or_file)
    };

    std::fs::read_to_string(&config_path).map_err(|error| format!("Failed to read file: {}", error))
  }

  pub fn load(path_or_file: &Path, version: Option<&str>) -> Result<Self, String> {
    let version = version.unwrap_or(DEFAULT_VERSION);

    if path_or_file.ends_with(CONFIG_PATH) {
      return Self::load_from_explicit_path(path_or_file, version);
    }

    let FoundConfigFile { config_path, project_root } = Self::find_config_file(path_or_file);

    match config_path {
      Some(config_path) => Self::load_from_path(&config_path, &project_root, version),
      None => Ok(Self::new(&project_root, Self::get_default_config(version), None)),
    }
  }

  pub fn from_object(partial: &HerbConfigOptions, project_path: &Path, version: Option<&str>, config_version: Option<String>) -> Result<Self, String> {
    let version = version.unwrap_or(DEFAULT_VERSION);
    let defaults = default_config_value(version);

    let partial_value = serde_yaml::to_value(partial).map_err(|error| format!("Configuration validation error: {}", error))?;
    let merged = deep_merge(&defaults, &partial_value);

    let config: HerbConfig = serde_yaml::from_value(merged).map_err(|error| format!("Configuration validation error: {}", error))?;

    Ok(Self::new(project_path, config, config_version))
  }

  fn load_from_explicit_path(config_path: &Path, version: &str) -> Result<Self, String> {
    if !config_path.exists() {
      return Err(format!("Configuration file '{}' does not exist", config_path.display()));
    }

    let project_root = config_path.parent().unwrap_or(Path::new(".")).to_path_buf();

    Self::read_and_validate_config(config_path, &project_root, version)
  }

  fn load_from_path(config_path: &Path, project_root: &Path, version: &str) -> Result<Self, String> {
    Self::read_and_validate_config(config_path, project_root, version)
  }

  fn read_and_validate_config(config_path: &Path, project_root: &Path, version: &str) -> Result<Self, String> {
    let content = std::fs::read_to_string(config_path).map_err(|error| format!("Failed to read {}: {}", config_path.display(), error))?;

    let mut parsed: serde_yaml::Value =
      serde_yaml::from_str(&content).map_err(|error| format!("Invalid YAML syntax in {}: {}", config_path.display(), error))?;

    if parsed.is_null() {
      parsed = serde_yaml::Value::Mapping(Default::default());
    }

    let user_config_version = parsed.get("version").and_then(|value| value.as_str()).map(String::from);

    if let Some(mapping) = parsed.as_mapping_mut() {
      mapping.insert(serde_yaml::Value::String("version".to_string()), serde_yaml::Value::String(version.to_string()));
    }

    serde_yaml::from_value::<HerbConfig>(parsed.clone()).map_err(|error| {
      let message = format!("Configuration errors in {}: {}", config_path.display(), error);

      match &user_config_version {
        Some(declared_version) if semver_greater_than(declared_version, version) => format!(
          "{}\n\n  This configuration declares version {}, but Herb {} is running. Options added after {} aren't recognized. Upgrade Herb to {} or newer.",
          message, declared_version, version, version, declared_version
        ),
        _ => message,
      }
    })?;

    let defaults = default_config_value(version);
    let mut resolved: HerbConfig =
      serde_yaml::from_value(deep_merge(&defaults, &parsed)).map_err(|error| format!("Configuration errors in {}: {}", config_path.display(), error))?;

    resolved.version = version.to_string();

    Ok(Self::new(project_root, resolved, user_config_version))
  }

  pub fn find_config_file(start_path: &Path) -> FoundConfigFile {
    let mut current_path = match std::fs::canonicalize(start_path) {
      Ok(path) => path,
      Err(_) => start_path.to_path_buf(),
    };

    if current_path.is_file() {
      current_path = current_path.parent().unwrap_or(Path::new(".")).to_path_buf();
    }

    let mut first_indicator_match: Option<PathBuf> = None;

    loop {
      let config_path = current_path.join(CONFIG_PATH);

      if config_path.exists() {
        return FoundConfigFile {
          config_path: Some(config_path),
          project_root: current_path,
        };
      }

      if first_indicator_match.is_none() && Self::is_project_root(&current_path) {
        first_indicator_match = Some(current_path.clone());
      }

      let parent_path = match current_path.parent() {
        Some(parent_path) if parent_path != current_path => parent_path.to_path_buf(),

        _ => {
          return FoundConfigFile {
            config_path: None,
            project_root: first_indicator_match.unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
          }
        }
      };

      current_path = parent_path;
    }
  }

  fn is_project_root(directory_path: &Path) -> bool {
    PROJECT_INDICATORS.iter().any(|indicator| {
      if let Some(extension) = indicator.strip_prefix('*') {
        return std::fs::read_dir(directory_path)
          .map(|entries| entries.flatten().any(|entry| entry.file_name().to_string_lossy().ends_with(extension)))
          .unwrap_or(false);
      }

      directory_path.join(indicator).exists()
    })
  }

  #[cfg(feature = "yerba")]
  fn create_default_config(project_root: &Path, silent: bool, version: &str) -> Result<Self, String> {
    let stray_yaml_path = project_root.join(".herb.yaml");

    if stray_yaml_path.exists() {
      return Err(format!(
        "Found `.herb.yaml` file at {}\n  Please rename it to `.herb.yml`",
        stray_yaml_path.display()
      ));
    }

    let config_path = Self::config_path_from_project_path(project_root);

    match crate::mutation::mutate_config_file(&config_path, &HerbConfigOptions::default(), Some(version)) {
      Ok(()) => {
        if !silent {
          eprintln!("\u{2713} Created default configuration at {}", config_path.display());
        }
      }

      Err(_) => {
        if !silent {
          eprintln!("\u{26a0} Could not create config file at {}, using defaults in-memory", config_path.display());
        }
      }
    }

    Ok(Self::new(project_root, Self::get_default_config(version), None))
  }

  #[cfg(not(feature = "yerba"))]
  fn create_default_config(project_root: &Path, _silent: bool, version: &str) -> Result<Self, String> {
    Ok(Self::new(project_root, Self::get_default_config(version), None))
  }

  pub fn get_default_config(version: &str) -> HerbConfig {
    default_config(version)
  }

  pub fn default_template() -> &'static str {
    config_template()
  }
}

pub struct FoundConfigFile {
  pub config_path: Option<PathBuf>,
  pub project_root: PathBuf,
}
