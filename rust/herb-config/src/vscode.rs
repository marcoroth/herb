use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const HERB_EXTENSION_ID: &str = "marcoroth.herb-lsp";
const VSCODE_DIR: &str = ".vscode";
const EXTENSIONS_FILE: &str = "extensions.json";

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VSCodeExtensionsJson {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub recommendations: Option<Vec<String>>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub unwanted_recommendations: Option<Vec<String>>,

  #[serde(flatten)]
  pub other: serde_json::Map<String, serde_json::Value>,
}

fn ensure_vscode_directory(project_path: &Path) -> std::io::Result<PathBuf> {
  let vscode_directory = project_path.join(VSCODE_DIR);

  if !vscode_directory.exists() {
    std::fs::create_dir_all(&vscode_directory)?;
  }

  Ok(vscode_directory)
}

fn extensions_json_path(project_path: &Path) -> std::io::Result<PathBuf> {
  Ok(ensure_vscode_directory(project_path)?.join(EXTENSIONS_FILE))
}

fn read_extensions_json(file_path: &Path) -> VSCodeExtensionsJson {
  let contents = match std::fs::read_to_string(file_path) {
    Ok(contents) => contents,
    Err(_) => {
      return VSCodeExtensionsJson {
        recommendations: Some(Vec::new()),
        ..Default::default()
      }
    }
  };

  match serde_json::from_str::<VSCodeExtensionsJson>(&contents) {
    Ok(mut parsed) => {
      if parsed.recommendations.is_none() {
        parsed.recommendations = Some(Vec::new());
      }

      parsed
    }

    Err(_) => {
      eprintln!("Warning: Could not parse {}, creating new file", file_path.display());

      VSCodeExtensionsJson {
        recommendations: Some(Vec::new()),
        ..Default::default()
      }
    }
  }
}

fn write_extensions_json(file_path: &Path, data: &VSCodeExtensionsJson) -> std::io::Result<()> {
  let contents = format!("{}\n", serde_json::to_string_pretty(data).unwrap_or_else(|_| "{}".to_string()));

  std::fs::write(file_path, contents)
}

pub fn add_herb_extension_recommendation(project_path: &Path) -> bool {
  let extensions_path = match extensions_json_path(project_path) {
    Ok(path) => path,
    Err(_) => return false,
  };

  let mut extensions = read_extensions_json(&extensions_path);
  let recommendations = extensions.recommendations.get_or_insert_with(Vec::new);

  if recommendations.iter().any(|recommendation| recommendation == HERB_EXTENSION_ID) {
    return false;
  }

  recommendations.push(HERB_EXTENSION_ID.to_string());

  write_extensions_json(&extensions_path, &extensions).is_ok()
}

pub fn get_extensions_json_relative_path() -> PathBuf {
  Path::new(VSCODE_DIR).join(EXTENSIONS_FILE)
}
