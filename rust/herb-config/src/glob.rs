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

fn build_named_matchers(patterns: &[impl AsRef<str>]) -> Vec<(String, GlobMatcher)> {
  patterns
    .iter()
    .filter_map(|pattern| build_matcher(pattern.as_ref()).map(|matcher| (pattern.as_ref().to_string(), matcher)))
    .collect()
}

fn literal_prefix_segments(pattern: &str) -> Vec<&str> {
  pattern
    .split('/')
    .take_while(|segment| !segment.contains(['*', '?', '[', ']', '{', '}']))
    .collect()
}

/// Check whether an include pattern is specific enough to override an exclude pattern.
///
/// An include pattern wins only when it targets the same directory as the exclude pattern or one
/// below it, comparing the literal (non-glob) leading path segments of each. This is what lets
/// `vendor/keep/**/*` opt a subdirectory back in past the default `vendor/**/*` exclude, while a
/// broad `**/*.html.erb` include overrides nothing.
///
/// Exclude patterns with no literal prefix (`**/*.generated.html.erb`) are never overridable,
/// because they select files by shape instead of by location.
pub fn include_overrides_exclude(include_pattern: &str, exclude_pattern: &str) -> bool {
  let exclude_prefix = literal_prefix_segments(exclude_pattern);

  if exclude_prefix.is_empty() {
    return false;
  }

  let include_prefix = literal_prefix_segments(include_pattern);

  include_prefix.len() >= exclude_prefix.len() && include_prefix.starts_with(&exclude_prefix)
}

pub fn is_path_excluded(file_path: &str, exclude_patterns: &[impl AsRef<str>], include_patterns: &[impl AsRef<str>]) -> bool {
  let matching_excludes: Vec<&str> = exclude_patterns
    .iter()
    .map(AsRef::as_ref)
    .filter(|pattern| build_matcher(pattern).is_some_and(|matcher| matcher.is_match(file_path)))
    .collect();

  if matching_excludes.is_empty() {
    return false;
  }

  let matching_includes: Vec<&str> = include_patterns
    .iter()
    .map(AsRef::as_ref)
    .filter(|pattern| build_matcher(pattern).is_some_and(|matcher| matcher.is_match(file_path)))
    .collect();

  if matching_includes.is_empty() {
    return true;
  }

  matching_excludes.iter().any(|exclude_pattern| {
    !matching_includes
      .iter()
      .any(|include_pattern| include_overrides_exclude(include_pattern, exclude_pattern))
  })
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

fn collect(
  directory: &Path,
  root: &Path,
  include: &[(String, GlobMatcher)],
  exclude: &[(String, GlobMatcher)],
  exclude_prefixes: &[String],
  files: &mut Vec<String>,
) {
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

    let matching_includes: Vec<&str> = include
      .iter()
      .filter(|(_, matcher)| matcher.is_match(&relative_path))
      .map(|(pattern, _)| pattern.as_str())
      .collect();

    if matching_includes.is_empty() {
      continue;
    }

    let excluded = exclude
      .iter()
      .filter(|(_, matcher)| matcher.is_match(&relative_path))
      .any(|(exclude_pattern, _)| {
        !matching_includes
          .iter()
          .any(|include_pattern| include_overrides_exclude(include_pattern, exclude_pattern))
      });

    if excluded {
      continue;
    }

    files.push(relative_path);
  }
}

pub fn glob(patterns: &[impl AsRef<str>], cwd: &Path, ignore: &[impl AsRef<str>]) -> Vec<String> {
  if patterns.is_empty() {
    return Vec::new();
  }

  let include = build_named_matchers(patterns);
  let exclude = build_named_matchers(ignore);

  let exclude_prefixes: Vec<String> = ignore
    .iter()
    .map(AsRef::as_ref)
    .filter(|exclude_pattern| {
      !patterns
        .iter()
        .any(|include_pattern| include_overrides_exclude(include_pattern.as_ref(), exclude_pattern))
    })
    .filter_map(literal_directory_prefix)
    .collect();

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
