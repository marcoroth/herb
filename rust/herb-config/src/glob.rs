use globset::GlobBuilder;

pub fn is_path_matching(file_path: &str, patterns: &[impl AsRef<str>]) -> bool {
  patterns.iter().any(|pattern| {
    GlobBuilder::new(pattern.as_ref())
      .literal_separator(true)
      .build()
      .ok()
      .map(|g| g.compile_matcher().is_match(file_path))
      .unwrap_or(false)
  })
}
