use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::severity::{Severity, SeverityConfig};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FilesConfig {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub include: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub exclude: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuleConfig {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub enabled: Option<bool>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub severity: Option<SeverityConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub auto_correct: Option<bool>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub include: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub only: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub exclude: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinterConfig {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub enabled: Option<bool>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub fail_level: Option<Severity>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub log_level: Option<Severity>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub include: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub exclude: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub rules: Option<HashMap<String, RuleConfig>>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RewriterConfig {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub pre: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub post: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FormatterConfig {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub enabled: Option<bool>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub include: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub exclude: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub indent_width: Option<usize>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub max_line_length: Option<usize>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub rewriter: Option<RewriterConfig>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Framework {
  Ruby,
  ActionView,
  Hanami,
  Sinatra,
}

impl Framework {
  pub const ALL: [Framework; 4] = [Framework::Ruby, Framework::ActionView, Framework::Hanami, Framework::Sinatra];

  pub fn as_str(&self) -> &'static str {
    match self {
      Framework::Ruby => "ruby",
      Framework::ActionView => "actionview",
      Framework::Hanami => "hanami",
      Framework::Sinatra => "sinatra",
    }
  }

  pub fn label(&self) -> &'static str {
    match self {
      Framework::Ruby => "Ruby",
      Framework::ActionView => "Action View",
      Framework::Hanami => "Hanami",
      Framework::Sinatra => "Sinatra",
    }
  }

  pub fn description(&self) -> &'static str {
    match self {
      Framework::Ruby => "plain ERB templates, with no framework helpers in scope",
      Framework::ActionView => "Action View templates, with their helpers, partials, and strict locals",
      Framework::Hanami => "Hanami views, with their parts and helpers",
      Framework::Sinatra => "Sinatra templates, with their helpers",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateEngine {
  Erubi,
  Erb,
  Herb,
}

pub type EngineConfig = serde_yaml::Mapping;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HerbConfigOptions {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub files: Option<FilesConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub engine: Option<EngineConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub linter: Option<LinterConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub formatter: Option<FormatterConfig>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HerbConfig {
  #[serde(default)]
  pub version: String,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub framework: Option<Framework>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub template_engine: Option<TemplateEngine>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub files: Option<FilesConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub engine: Option<EngineConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub linter: Option<LinterConfig>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub formatter: Option<FormatterConfig>,
}
