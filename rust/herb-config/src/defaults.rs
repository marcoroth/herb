use std::sync::OnceLock;

use serde_yaml::Value;

use crate::config_schema::HerbConfig;

pub const DEFAULT_VERSION: &str = env!("CARGO_PKG_VERSION");

const DEFAULTS_YAML: &str = include_str!("../../../lib/herb/defaults.yml");
const CONFIG_TEMPLATE: &str = include_str!("../../../javascript/packages/config/src/config-template.yml");

pub fn parsed_defaults() -> &'static Value {
  static PARSED_DEFAULTS: OnceLock<Value> = OnceLock::new();

  PARSED_DEFAULTS.get_or_init(|| serde_yaml::from_str(DEFAULTS_YAML).expect("lib/herb/defaults.yml must be valid YAML"))
}

pub fn default_config_value(version: &str) -> Value {
  let mut value = parsed_defaults().clone();

  if let Some(mapping) = value.as_mapping_mut() {
    mapping.insert(Value::String("version".to_string()), Value::String(version.to_string()));
  }

  value
}

pub fn default_config(version: &str) -> HerbConfig {
  serde_yaml::from_value(default_config_value(version)).expect("lib/herb/defaults.yml must match the config schema")
}

pub fn config_template() -> &'static str {
  CONFIG_TEMPLATE
}
