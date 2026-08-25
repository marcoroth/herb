use std::path::{Path, PathBuf};

pub const PARTIAL_PREFIX: &str = "_";
pub const VIEW_ROOT: &str = "app/views";
pub const LAYOUTS_DIRECTORY: &str = "layouts";
pub const APPLICATION_LAYOUT: &str = "application";
pub const MAILER_LAYOUT: &str = "mailer";
pub const MAILER_SUFFIX: &str = "_mailer";
pub const APPLICATION_DIRECTORY: &str = "application";

pub const EXTENSIONS: [&str; 6] = [".html.erb", ".html.herb", ".erb", ".herb", ".turbo_stream.erb", ".turbo_stream.herb"];

pub fn template_glob_pattern() -> String {
  let alternatives: Vec<&str> = EXTENSIONS.iter().map(|extension| &extension[1..]).collect();

  format!("*.{{{}}}", alternatives.join(","))
}

pub fn partial_glob_pattern() -> String {
  format!("{}{}", PARTIAL_PREFIX, template_glob_pattern())
}

pub fn view_root_for(project_path: &Path) -> PathBuf {
  let candidate = project_path.join(VIEW_ROOT);

  if candidate.is_dir() {
    candidate
  } else {
    project_path.to_path_buf()
  }
}

fn basename(path: &str) -> &str {
  match path.rfind('/') {
    Some(index) => &path[index + 1..],
    None => path,
  }
}

fn dirname(path: &str) -> &str {
  match path.rfind('/') {
    Some(0) => "/",
    Some(index) => &path[..index],
    None => ".",
  }
}

fn normalize(path: &str) -> String {
  let separated = path.replace('\\', "/");
  let trimmed = separated.trim_end_matches('/');

  if trimmed.is_empty() && separated.starts_with('/') {
    "/".to_string()
  } else {
    trimmed.to_string()
  }
}

pub fn template_path(file: &str) -> bool {
  let normalized = normalize(file);
  let name = basename(&normalized);

  EXTENSIONS.iter().any(|extension| name.ends_with(extension))
}

pub fn partial_path(file: &str) -> bool {
  let normalized = normalize(file);
  let name = basename(&normalized);

  name.starts_with(PARTIAL_PREFIX) && EXTENSIONS.iter().any(|extension| name.ends_with(extension))
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

  let prefix = format!("{}/", normalized_root);

  normalized_path.strip_prefix(&prefix).map(|rest| rest.to_string())
}

fn without_extension(name: &str) -> &str {
  match name.find('.') {
    Some(index) => &name[..index],
    None => name,
  }
}

pub fn partial_name_for(file: &str, view_root: &str) -> Option<String> {
  if !partial_path(file) {
    return None;
  }

  let relative = relative_to_view_root(file, view_root)?;

  if relative == "." {
    return None;
  }

  let directory = dirname(&relative);
  let name = basename(&relative);

  let stripped = name.strip_prefix(PARTIAL_PREFIX)?;
  let without = without_extension(stripped);

  if without.is_empty() {
    return None;
  }

  if directory == "." {
    Some(without.to_string())
  } else {
    Some(format!("{}/{}", directory, without))
  }
}

pub fn template_name_for(file: &str, view_root: &str) -> Option<String> {
  if partial_path(file) {
    return None;
  }

  let relative = relative_to_view_root(file, view_root)?;

  if relative == "." {
    return None;
  }

  let directory = dirname(&relative);
  let name = basename(&relative);
  let without = without_extension(name);

  if without.is_empty() {
    return None;
  }

  if directory == "." {
    Some(without.to_string())
  } else {
    Some(format!("{}/{}", directory, without))
  }
}

pub fn layout_candidates_for(template_file: &str, view_root: &str) -> Vec<String> {
  let Some(relative) = relative_to_view_root(template_file, view_root) else {
    return Vec::new();
  };

  if relative == "." || basename(&relative).starts_with(PARTIAL_PREFIX) {
    return Vec::new();
  }

  let directory = dirname(&relative);

  if directory == LAYOUTS_DIRECTORY || directory.starts_with(&format!("{}/", LAYOUTS_DIRECTORY)) {
    return Vec::new();
  }

  if directory == "." || directory == "/" {
    return vec![format!("{}/{}", LAYOUTS_DIRECTORY, APPLICATION_LAYOUT)];
  }

  let mut segments: Vec<&str> = directory.split('/').collect();
  let is_mailer = segments.last().map(|last| last.ends_with(MAILER_SUFFIX)).unwrap_or(false);
  let mut candidates = Vec::new();

  while !segments.is_empty() {
    candidates.push(format!("{}/{}", LAYOUTS_DIRECTORY, segments.join("/")));
    segments.pop();
  }

  candidates.push(format!("{}/{}", LAYOUTS_DIRECTORY, if is_mailer { MAILER_LAYOUT } else { APPLICATION_LAYOUT }));

  candidates
}

pub fn template_rank(file: &str) -> usize {
  let normalized = normalize(file);
  let base = basename(&normalized);

  let Some(dot) = base.find('.') else {
    return EXTENSIONS.len();
  };

  EXTENSIONS.iter().position(|extension| *extension == &base[dot..]).unwrap_or(EXTENSIONS.len())
}

pub fn outranks_template(candidate: &str, incumbent: &str) -> bool {
  let candidate_rank = template_rank(candidate);
  let incumbent_rank = template_rank(incumbent);

  if candidate_rank != incumbent_rank {
    return candidate_rank < incumbent_rank;
  }

  candidate < incumbent
}

pub fn by_precedence(files: &mut [String]) {
  files.sort_by(|a, b| {
    if outranks_template(a, b) {
      std::cmp::Ordering::Less
    } else {
      std::cmp::Ordering::Greater
    }
  });
}
