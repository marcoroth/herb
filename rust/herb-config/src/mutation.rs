use std::path::Path;

use serde_yaml::Value;

use crate::config_schema::HerbConfigOptions;
use crate::defaults::{config_template, DEFAULT_VERSION};

fn apply_mutation_to_document(document: &mut yerba::Document, mutation: &Value, prefix: &str) -> Result<(), String> {
  let mapping = match mutation.as_mapping() {
    Some(mapping) => mapping,
    None => return Ok(()),
  };

  for (key, value) in mapping {
    let key = match key.as_str() {
      Some(key) => key,
      None => continue,
    };

    let path = if prefix.is_empty() { key.to_string() } else { format!("{}.{}", prefix, key) };

    if value.is_mapping() {
      if document.is_valid_selector(&path) {
        apply_mutation_to_document(document, value, &path)?;
      } else {
        insert_value(document, &path, value)?;
      }

      continue;
    }

    set_or_insert(document, &path, &scalar_text(value))?;
  }

  Ok(())
}

fn insert_value(document: &mut yerba::Document, path: &str, value: &Value) -> Result<(), String> {
  let json: serde_json::Value = serde_json::to_value(value).map_err(|error| error.to_string())?;
  let quote_style = document.detect_sequence_quote_style(path);
  let mut text = yerba::json_to_yaml_text(&json, &quote_style, 0);

  if !text.ends_with('\n') {
    text.push('\n');
  }

  document
    .insert_into(path, &text, yerba::InsertPosition::Last)
    .map_err(|error| format!("failed to insert `{}`: {}", path, error))
}

fn set_or_insert(document: &mut yerba::Document, path: &str, value: &str) -> Result<(), String> {
  if document.is_valid_selector(path) {
    document.set(path, value).map_err(|error| format!("failed to set `{}`: {}", path, error))
  } else {
    document
      .insert_into(path, value, yerba::InsertPosition::Last)
      .map_err(|error| format!("failed to insert `{}`: {}", path, error))
  }
}

fn scalar_text(value: &Value) -> String {
  match value {
    Value::Null => String::new(),
    Value::Bool(value) => value.to_string(),
    Value::Number(value) => value.to_string(),
    Value::String(value) => value.clone(),
    other => serde_yaml::to_string(other).unwrap_or_default().trim_end().to_string(),
  }
}

pub fn apply_mutation_to_yaml_string(yaml: &str, mutation: &HerbConfigOptions) -> Result<String, String> {
  let mut document = yerba::parse(yaml).map_err(|error| format!("failed to parse YAML: {}", error))?;
  let mutation = serde_yaml::to_value(mutation).map_err(|error| error.to_string())?;

  apply_mutation_to_document(&mut document, &mutation, "")?;

  Ok(document.to_string())
}

pub fn create_config_yaml_string(mutation: &HerbConfigOptions, version: Option<&str>) -> Result<String, String> {
  let version = version.unwrap_or(DEFAULT_VERSION);

  let mut document = yerba::parse(config_template()).map_err(|error| format!("failed to parse config template: {}", error))?;

  document.set("version", version).map_err(|error| format!("failed to set version: {}", error))?;

  if mutation != &HerbConfigOptions::default() {
    let mutation = serde_yaml::to_value(mutation).map_err(|error| error.to_string())?;

    apply_mutation_to_document(&mut document, &mutation, "")?;
  }

  Ok(document.to_string())
}

pub fn mutate_config_file(config_path: &Path, mutation: &HerbConfigOptions, version: Option<&str>) -> Result<(), String> {
  let contents = match std::fs::read_to_string(config_path) {
    Ok(contents) => apply_mutation_to_yaml_string(&contents, mutation)?,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => create_config_yaml_string(mutation, version)?,
    Err(error) => return Err(format!("failed to read {}: {}", config_path.display(), error)),
  };

  if let Some(parent) = config_path.parent() {
    std::fs::create_dir_all(parent).map_err(|error| format!("failed to create {}: {}", parent.display(), error))?;
  }

  std::fs::write(config_path, contents).map_err(|error| format!("failed to write {}: {}", config_path.display(), error))
}

pub fn add_yaml_spacing(yaml: &str) -> String {
  let lines: Vec<&str> = yaml.split('\n').collect();
  let mut result: Vec<String> = Vec::new();

  let is_top_level_key = |line: &str| {
    line.starts_with(|character: char| character.is_ascii_lowercase())
      && line
        .split(':')
        .next()
        .map(|key| key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'))
        .unwrap_or(false)
      && line.contains(':')
  };

  let is_nested_key =
    |line: &str| line.starts_with("    ") && line.trim_start().starts_with(|character: char| character.is_ascii_lowercase()) && line.contains(':');

  for (index, line) in lines.iter().enumerate() {
    let previous = if index > 0 { Some(lines[index - 1]) } else { None };

    if index > 0 {
      if let Some(previous) = previous {
        if is_top_level_key(line) && !previous.trim().starts_with("version:") && !previous.trim().is_empty() {
          result.push(String::new());
        }
      }
    }

    if is_nested_key(line) {
      if let Some(previous) = previous {
        if previous.starts_with("      ") {
          result.push(String::new());
        }
      }
    }

    result.push((*line).to_string());
  }

  result.join("\n")
}
