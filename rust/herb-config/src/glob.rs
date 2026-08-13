use std::path::Path;

use globset::{GlobBuilder, GlobMatcher};

fn build_matcher(pattern: &str) -> Option<GlobMatcher> {
  GlobBuilder::new(pattern)
    .literal_separator(true)
    .build()
    .ok()
    .map(|glob| glob.compile_matcher())
}

fn build_matchers(patterns: &[impl AsRef<str>]) -> Vec<GlobMatcher> {
  patterns.iter().filter_map(|pattern| build_matcher(pattern.as_ref())).collect()
}

pub fn is_path_matching(file_path: &str, patterns: &[impl AsRef<str>]) -> bool {
  build_matchers(patterns).iter().any(|matcher| matcher.is_match(file_path))
}

fn literal_directory_prefix(pattern: &str) -> Option<String> {
  let first_glob = pattern.find(['*', '?', '[', '{'])?;
  let prefix = &pattern[..first_glob];
  let last_separator = prefix.rfind('/')?;

  Some(prefix[..last_separator].to_string())
}

fn is_directory_pruned(relative_path: &str, exclude_prefixes: &[String]) -> bool {
  exclude_prefixes
    .iter()
    .any(|prefix| relative_path == prefix || relative_path.starts_with(&format!("{}/", prefix)))
}

fn collect(directory: &Path, root: &Path, include: &[GlobMatcher], exclude: &[GlobMatcher], exclude_prefixes: &[String], files: &mut Vec<String>) {
  let entries = match std::fs::read_dir(directory) {
    Ok(entries) => entries,
    Err(_) => return,
  };

  for entry in entries.flatten() {
    let name = entry.file_name();
    let name = name.to_string_lossy();

    if name.starts_with('.') {
      continue;
    }

    let path = entry.path();

    let relative_path = match path.strip_prefix(root) {
      Ok(relative_path) => relative_path.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/"),
      Err(_) => continue,
    };

    if path.is_dir() {
      if is_directory_pruned(&relative_path, exclude_prefixes) {
        continue;
      }

      collect(&path, root, include, exclude, exclude_prefixes, files);

      continue;
    }

    if !include.iter().any(|matcher| matcher.is_match(&relative_path)) {
      continue;
    }

    if exclude.iter().any(|matcher| matcher.is_match(&relative_path)) {
      continue;
    }

    files.push(relative_path);
  }
}

pub fn glob(patterns: &[impl AsRef<str>], cwd: &Path, ignore: &[impl AsRef<str>]) -> Vec<String> {
  if patterns.is_empty() {
    return Vec::new();
  }

  let include = build_matchers(patterns);
  let exclude = build_matchers(ignore);
  let exclude_prefixes: Vec<String> = ignore.iter().filter_map(|pattern| literal_directory_prefix(pattern.as_ref())).collect();

  let mut files = Vec::new();

  if cwd.is_file() {
    return Vec::new();
  }

  collect(cwd, cwd, &include, &exclude, &exclude_prefixes, &mut files);

  files.sort();
  files
}

pub fn glob_absolute(patterns: &[impl AsRef<str>], cwd: &Path, ignore: &[impl AsRef<str>]) -> Vec<String> {
  glob(patterns, cwd, ignore)
    .into_iter()
    .map(|relative_path| cwd.join(relative_path).to_string_lossy().into_owned())
    .collect()
}
