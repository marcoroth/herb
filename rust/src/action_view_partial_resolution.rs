use std::collections::HashMap;

pub const PARTIAL_EXTENSIONS: &[&str] = &[".html.erb", ".html.herb", ".erb", ".herb", ".turbo_stream.erb", ".turbo_stream.herb"];

pub const PARTIAL_GLOB_PATTERN: &str = "_*.{html.erb,html.herb,erb,herb,turbo_stream.erb,turbo_stream.herb}";

const PARTIAL_PREFIX: &str = "_";
const APPLICATION_DIRECTORY: &str = "application";

pub type PartialPaths = HashMap<String, String>;

fn normalize(path: &str) -> String {
  let separated = path.replace('\\', "/");

  separated.trim_end_matches('/').to_string()
}

fn basename(path: &str) -> &str {
  match path.rfind('/') {
    Some(index) => &path[index + 1..],
    None => path,
  }
}

fn dirname(path: &str) -> &str {
  match path.rfind('/') {
    None => ".",
    Some(0) => "/",
    Some(index) => &path[..index],
  }
}

fn relative_to_view_root(path: &str, view_root: &str) -> Option<String> {
  let normalized_path = normalize(path);
  let normalized_root = normalize(view_root);

  if normalized_root.is_empty() || normalized_root == "." {
    return Some(normalized_path);
  }

  if normalized_path == normalized_root {
    return Some(".".to_string());
  }

  let prefix = format!("{normalized_root}/");

  normalized_path.strip_prefix(&prefix).map(String::from)
}

pub fn is_partial_path(file_path: &str) -> bool {
  let normalized = normalize(file_path);
  let name = basename(&normalized);

  if !name.starts_with(PARTIAL_PREFIX) {
    return false;
  }

  PARTIAL_EXTENSIONS.iter().any(|extension| name.ends_with(extension))
}

pub fn partial_name_for_file(file_path: &str, view_root: &str) -> Option<String> {
  let relative = relative_to_view_root(file_path, view_root)?;

  if relative == "." {
    return None;
  }

  let directory = dirname(&relative);
  let name = basename(&relative);

  let without_prefix = name.strip_prefix(PARTIAL_PREFIX)?;

  let without_extension = match without_prefix.find('.') {
    Some(index) => &without_prefix[..index],
    None => without_prefix,
  };

  if without_extension.is_empty() {
    return None;
  }

  if directory == "." {
    Some(without_extension.to_string())
  } else {
    Some(format!("{directory}/{without_extension}"))
  }
}

pub fn resolve_partial(partial_name: &str, source_file: &str, index: &PartialPaths, view_root: &str) -> Option<String> {
  if let Some(exact) = index.get(partial_name) {
    return Some(exact.clone());
  }

  let source_directory = relative_to_view_root(dirname(&normalize(source_file)), view_root);

  if let Some(source_directory) = source_directory {
    if source_directory != "." {
      if let Some(relative) = index.get(&format!("{source_directory}/{partial_name}")) {
        return Some(relative.clone());
      }
    }
  }

  if !partial_name.contains('/') {
    if let Some(application) = index.get(&format!("{APPLICATION_DIRECTORY}/{partial_name}")) {
      return Some(application.clone());
    }
  }

  None
}
