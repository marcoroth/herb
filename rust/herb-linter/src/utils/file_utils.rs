pub fn is_partial_file(file_name: &str) -> bool {
  let basename = file_name.rsplit('/').next().or_else(|| file_name.rsplit('\\').next()).unwrap_or(file_name);

  basename.starts_with('_')
}
