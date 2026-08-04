pub mod glob;
pub mod semver;
pub mod validation;
pub mod vscode;

mod config;
mod config_schema;
mod defaults;
mod merge;
#[cfg(feature = "yerba")]
mod mutation;
mod severity;

pub use config::{Config, FoundConfigFile, FromObjectOptions, LoadOptions, SeverityOverridable, Tool, ALL_RULES_KEY, CONFIG_PATH, MISNAMED_CONFIG_PATHS};

pub use config_schema::{
  EngineConfig, FilesConfig, FormatterConfig, Framework, HerbConfig, HerbConfigOptions, LinterConfig, ParserOptionsConfig, RewriterConfig, RuleConfig,
  TemplateEngine, ValidatorsConfig,
};

pub use defaults::DEFAULT_VERSION;
pub use glob::is_path_matching;
pub use merge::deep_merge;
#[cfg(feature = "yerba")]
pub use mutation::{add_yaml_spacing, apply_mutation_to_yaml_string, create_config_yaml_string, mutate_config_file};
pub use semver::{compare_semver, parse_semver, semver_greater_than, UNRELEASED_VERSION};
pub use severity::{resolve_severity, LinterMode, Severity, SeverityConfig};
pub use validation::{validate_config_text, ConfigValidationError, ValidateOptions, ValidationSeverity};
pub use vscode::{add_herb_extension_recommendation, get_extensions_json_relative_path, VSCodeExtensionsJson};
