use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use herb::herb::{parse_with_options, ParserOptions};
use herb::prism::PrismNode;
use rubydex::listing;

const RENDER: &str = "render";
const CALL_NODE: &str = "CallNode";
const STRING_NODE: &str = "StringNode";
const INTERPOLATED_STRING_NODE: &str = "InterpolatedStringNode";
const PARTIAL_WRITER: &str = "partial=";
const PARTIAL: &str = "partial";
const LOCAL_VARIABLE_WRITE: &str = "LocalVariableWriteNode";
const INSTANCE_VARIABLE_WRITE: &str = "InstanceVariableWriteNode";

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RubyRenderReferences {
  pub names: BTreeSet<String>,
  pub prefixes: BTreeSet<String>,
  pub files_scanned: usize,
}

impl RubyRenderReferences {
  pub fn covers(&self, partial_name: &str) -> bool {
    if self.names.contains(partial_name) {
      return true;
    }

    self.prefixes.iter().any(|prefix| partial_name.starts_with(prefix.as_str()))
  }
}

pub fn collect(project_path: &Path) -> RubyRenderReferences {
  let roots: Vec<String> = ["app", "lib"]
    .iter()
    .map(|directory| project_path.join(directory))
    .filter(|path| path.is_dir())
    .filter_map(|path| path.to_str().map(|text| text.to_string()))
    .collect();

  if roots.is_empty() {
    return RubyRenderReferences::default();
  }

  let excluded: HashSet<PathBuf> = HashSet::new();
  let (files, _) = listing::collect_file_paths(roots, &excluded);

  let mut references = RubyRenderReferences::default();

  for file in files {
    if file.extension().and_then(|extension| extension.to_str()) != Some("rb") {
      continue;
    }

    let Ok(source) = fs::read_to_string(&file) else {
      continue;
    };

    references.files_scanned += 1;

    if !source.contains(RENDER) && !source.contains(PARTIAL) {
      continue;
    }

    collect_from_source(&source, &mut references);
  }

  references
}

pub fn collect_from_source(source: &str, references: &mut RubyRenderReferences) {
  let wrapped = format!("<% {} %>", source);
  let options = ParserOptions {
    prism_nodes: true,
    ..Default::default()
  };

  let Ok(result) = parse_with_options(&wrapped, &options) else {
    return;
  };

  for child in &result.value.children {
    if let herb::nodes::AnyNode::ERBContentNode(node) = child {
      if let Some(prism) = node.prism() {
        walk(prism, references);
      }
    }
  }
}

fn walk(node: &PrismNode, references: &mut RubyRenderReferences) {
  if node.is(CALL_NODE) && matches!(node.name.as_deref(), Some(RENDER) | Some(PARTIAL_WRITER)) {
    for argument in &node.children {
      collect_argument(argument, references);
    }
  }

  if (node.is(LOCAL_VARIABLE_WRITE) || node.is(INSTANCE_VARIABLE_WRITE)) && assigns_partial(node) {
    for child in &node.children {
      collect_argument(child, references);
    }
  }

  for child in &node.children {
    walk(child, references);
  }
}

fn assigns_partial(node: &PrismNode) -> bool {
  node.name.as_deref().map(|name| name.trim_start_matches('@') == PARTIAL).unwrap_or(false)
}

fn collect_argument(node: &PrismNode, references: &mut RubyRenderReferences) {
  if node.is(STRING_NODE) {
    if let Some(value) = &node.unescaped {
      if is_partial_name(value) {
        references.names.insert(value.clone());
      }
    }

    return;
  }

  if node.is(INTERPOLATED_STRING_NODE) {
    if let Some(prefix) = interpolated_prefix(node) {
      references.prefixes.insert(prefix);
    }

    return;
  }

  for child in &node.children {
    collect_argument(child, references);
  }
}

fn interpolated_prefix(node: &PrismNode) -> Option<String> {
  let first = node.children.first()?;

  if !first.is(STRING_NODE) {
    return None;
  }

  let value = first.unescaped.as_ref()?;
  let prefix = value.rsplit_once('/').map(|(head, _)| head)?;

  if prefix.is_empty() {
    None
  } else {
    Some(format!("{prefix}/"))
  }
}

fn is_partial_name(value: &str) -> bool {
  !value.is_empty()
    && value
      .chars()
      .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_' || character == '/')
}

pub fn scan_template_source(source: &str) -> Vec<String> {
  let mut found = Vec::new();
  let bytes = source.as_bytes();
  let mut index = 0;

  while let Some(position) = source[index..].find("render") {
    let start = index + position;
    let mut cursor = start + "render".len();

    match bytes.get(cursor) {
      Some(b' ') | Some(b'(') | Some(b'\t') | Some(b'\n') | Some(b'\r') => {}
      _ => {
        index = cursor;
        continue;
      }
    }

    while matches!(bytes.get(cursor), Some(b' ') | Some(b'(') | Some(b'\t') | Some(b'\n') | Some(b'\r')) {
      cursor += 1;
    }

    if source[cursor..].starts_with("partial:") {
      cursor += "partial:".len();

      while matches!(bytes.get(cursor), Some(b' ') | Some(b'\t') | Some(b'\n') | Some(b'\r')) {
        cursor += 1;
      }
    }

    let quote = match bytes.get(cursor) {
      Some(b'"') => b'"',
      Some(b'\'') => b'\'',
      _ => {
        index = cursor.max(start + 1);
        continue;
      }
    };

    cursor += 1;
    let value_start = cursor;

    while let Some(byte) = bytes.get(cursor) {
      if *byte == quote {
        break;
      }

      cursor += 1;
    }

    let value = &source[value_start..cursor.min(source.len())];

    if !value.is_empty() && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '/') {
      found.push(value.to_string());
    }

    index = cursor.max(start + 1);
  }

  found
}

pub fn scan_template_dynamic_prefixes(source: &str) -> Vec<String> {
  let mut found = Vec::new();
  let mut index = 0;

  while let Some(position) = source[index..].find("render") {
    let start = index + position;
    let rest = &source[start..];

    let Some(quote_offset) = rest.find(['"', '\'']) else {
      break;
    };

    let after_quote = &rest[quote_offset + 1..];

    let Some(interpolation) = after_quote.find("#{") else {
      index = start + quote_offset + 1;
      continue;
    };

    let literal = &after_quote[..interpolation];

    if let Some(prefix) = literal.strip_suffix('/') {
      if !prefix.is_empty() && prefix.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '/') {
        found.push(prefix.to_string());
      }
    }

    index = start + quote_offset + 1;
  }

  found
}
