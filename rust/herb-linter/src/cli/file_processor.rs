use crate::cli::argument_parser::{CliArguments, FailLevel};
use crate::*;

/// Rayon worker threads default to a smaller stack than the main thread, and a
/// debug build's stack frames are large enough that walking a real template
/// overflows it. Matching the main thread keeps the two builds behaving alike.
const WORKER_STACK_SIZE: usize = 8 * 1024 * 1024;

pub(crate) struct ProcessedFile {
  pub(crate) filename: String,
  pub(crate) offense: Offense,
}

pub(crate) struct RuleOffenseStats {
  pub(crate) count: usize,
  pub(crate) files: HashSet<String>,
}

pub(crate) struct ProcessingResult {
  pub(crate) files: Vec<String>,
  pub(crate) all_offenses: Vec<ProcessedFile>,
  pub(crate) total_errors: usize,
  pub(crate) total_warnings: usize,
  pub(crate) total_info: usize,
  pub(crate) total_hints: usize,
  pub(crate) files_with_offenses: usize,
  pub(crate) total_ignored: usize,
  pub(crate) total_would_be_ignored: usize,
  pub(crate) rule_count: usize,
  pub(crate) rules_disabled_by_config: usize,
  pub(crate) rules_not_enabled_by_default: usize,
  pub(crate) autofixable_count: usize,
  pub(crate) unsafe_autofixable_count: usize,
  pub(crate) rules_skipped_by_version: Vec<(String, String)>,
  pub(crate) rule_offenses: Vec<(String, RuleOffenseStats)>,
}

pub(crate) fn determine_project_path(patterns: &[String], current_directory: &Path) -> PathBuf {
  if let Some(pattern) = patterns.first() {
    let resolved_pattern = current_directory.join(pattern);

    if resolved_pattern.exists() {
      return Config::find_project_root(&resolved_pattern);
    }
  }

  current_directory.to_path_buf()
}

pub(crate) fn adjust_pattern(pattern: &str, config_glob_patterns: &[String], project_path: &Path, current_directory: &Path) -> Vec<String> {
  let resolved_pattern = current_directory.join(pattern);

  if resolved_pattern.exists() {
    if resolved_pattern.is_dir() {
      let relative_directory = relative_path(project_path, &resolved_pattern);

      if relative_directory.is_empty() {
        return config_glob_patterns.to_vec();
      }

      return config_glob_patterns
        .iter()
        .map(|config_pattern| format!("{}/{}", relative_directory, config_pattern))
        .collect();
    }

    if resolved_pattern.is_file() {
      return vec![relative_path(project_path, &resolved_pattern)];
    }
  }

  vec![pattern.to_string()]
}

pub(crate) fn relative_path(from: &Path, to: &Path) -> String {
  let from = std::fs::canonicalize(from).unwrap_or_else(|_| from.to_path_buf());
  let to = std::fs::canonicalize(to).unwrap_or_else(|_| to.to_path_buf());

  to.strip_prefix(&from)
    .map(|path| path.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/"))
    .unwrap_or_else(|_| to.to_string_lossy().into_owned())
}

pub(crate) fn resolve_pattern_to_files(
  pattern: &str,
  config: &Config,
  project_path: &Path,
  force: bool,
  arguments: &CliArguments,
) -> (Vec<String>, Option<String>) {
  let current_directory = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  let resolved_pattern = current_directory.join(pattern);

  let explicit_file = if resolved_pattern.is_file() { Some(pattern.to_string()) } else { None };

  let files_config = config.get_files_config_for_tool(Tool::Linter);

  let config_glob_patterns = match files_config.include {
    Some(ref include) if !include.is_empty() => include.clone(),
    _ => vec!["**/*.html.erb".to_string()],
  };

  let adjusted_patterns = adjust_pattern(pattern, &config_glob_patterns, project_path, &current_directory);

  let mut files = config.glob_files(&adjusted_patterns, project_path, &files_config.exclude.unwrap_or_default());

  if let Some(ref explicit_file) = explicit_file {
    if files.is_empty() {
      if !force {
        output_error(&format!("⚠️  File {} is excluded by configuration patterns.", explicit_file), arguments);
        output_error("   Use --force to lint it anyway.\n", arguments);
        std::process::exit(0);
      }

      output_info(&format!("⚠️  Forcing linter on excluded file: {}", explicit_file), arguments);

      files = adjusted_patterns;
    }
  }

  (files, explicit_file)
}

pub(crate) struct FileLintResult {
  pub(crate) file_path: String,
  pub(crate) offenses: Vec<Offense>,
  pub(crate) errors: usize,
  pub(crate) warnings: usize,
  pub(crate) info: usize,
  pub(crate) hints: usize,
  pub(crate) ignored: usize,
  pub(crate) would_be_ignored: usize,
}

pub(crate) fn refresh_partials(
  partials: &std::sync::Mutex<std::sync::Arc<herb::action_view_partial_index::PartialIndex>>,
  file_path: &str,
  before: &str,
  after: &str,
) {
  let mut guard = match partials.lock() {
    Ok(guard) => guard,
    Err(_) => return,
  };

  let mut updated = (**guard).clone();

  if refresh_partial_after_fix(&mut updated, file_path, before, after) {
    *guard = std::sync::Arc::new(updated);
  }
}

pub(crate) fn lint_files(
  files: &[String],
  project_path: &Path,
  config: &Config,
  fix: bool,
  fix_unsafe: bool,
  ignore_disable_comments: bool,
  only_rules: &[String],
  all_rules: bool,
  show_fix_diff: bool,
) -> ProcessingResult {
  let linter = Linter::new(config.clone()).with_only(only_rules.to_vec()).with_all_rules(all_rules);
  let partials = std::sync::Mutex::new(std::sync::Arc::new(build_partial_index(project_path)));
  let rule_count = linter.rule_count();
  let rules_disabled_by_config = linter.rules_disabled_by_config();
  let rules_not_enabled_by_default = linter.rules_not_enabled_by_default();

  let pool = rayon::ThreadPoolBuilder::new().stack_size(WORKER_STACK_SIZE).build();

  let lint_all = || -> Vec<FileLintResult> {
    files
      .par_iter()
      .filter_map(|file_path| {
        let resolved_path = project_path.join(file_path);

        let source = match std::fs::read_to_string(&resolved_path) {
          Ok(content) => content,
          Err(error) => {
            eprintln!("Error reading file '{}': {}", file_path, error);
            return None;
          }
        };

        let context = LintContext {
          file_name: Some(file_path.clone()),
          ignore_disable_comments,
          partials: partials.lock().ok().map(|partials| partials.clone()),
          ..Default::default()
        };

        let result = if fix || fix_unsafe {
          let autofixed = linter.autofix(&source, &context, fix_unsafe);

          if autofixed.source != source {
            if let Err(error) = std::fs::write(&resolved_path, &autofixed.source) {
              eprintln!("Error writing file '{}': {}", file_path, error);
            }

            refresh_partials(&partials, file_path, &source, &autofixed.source);
          }

          linter.lint(&autofixed.source, &context)
        } else {
          if show_fix_diff {
            let preview = linter.autofix(&source, &context, fix_unsafe);

            if preview.source != source {
              print_fix_diff(&file_path, &source, &preview.source);
            }
          }

          linter.lint(&source, &context)
        };

        Some(FileLintResult {
          file_path: file_path.clone(),
          offenses: result.offenses,
          errors: result.errors,
          warnings: result.warnings,
          info: result.info,
          hints: result.hints,
          ignored: result.ignored,
          would_be_ignored: result.would_be_ignored,
        })
      })
      .collect()
  };

  let file_results: Vec<FileLintResult> = match pool {
    Ok(pool) => pool.install(lint_all),
    Err(_) => lint_all(),
  };

  let mut all_offenses = Vec::new();
  let mut total_errors = 0usize;
  let mut total_warnings = 0usize;
  let mut total_info = 0usize;
  let mut total_hints = 0usize;
  let mut files_with_offenses = 0usize;
  let mut total_ignored = 0usize;
  let mut total_would_be_ignored = 0usize;
  let mut rule_offenses: Vec<(String, RuleOffenseStats)> = Vec::new();

  for file_result in file_results {
    if !file_result.offenses.is_empty() {
      files_with_offenses += 1;
    }

    total_errors += file_result.errors;
    total_warnings += file_result.warnings;
    total_info += file_result.info;
    total_hints += file_result.hints;
    total_ignored += file_result.ignored;
    total_would_be_ignored += file_result.would_be_ignored;

    for offense in file_result.offenses {
      let stats = match rule_offenses.iter().position(|(rule, _)| *rule == offense.rule) {
        Some(index) => &mut rule_offenses[index].1,
        None => {
          rule_offenses.push((
            offense.rule.clone(),
            RuleOffenseStats {
              count: 0,
              files: HashSet::new(),
            },
          ));

          &mut rule_offenses.last_mut().expect("just pushed").1
        }
      };

      stats.count += 1;
      stats.files.insert(file_result.file_path.clone());

      all_offenses.push(ProcessedFile {
        filename: file_result.file_path.clone(),
        offense,
      });
    }
  }

  let autofixable_count = all_offenses
    .iter()
    .filter(|processed| linter.fixability_for(&processed.offense).autocorrectable)
    .count();

  let unsafe_autofixable_count = all_offenses
    .iter()
    .filter(|processed| linter.fixability_for(&processed.offense).unsafe_autocorrectable)
    .count();

  let rules_skipped_by_version: Vec<(String, String)> = linter
    .rules_skipped_by_version()
    .into_iter()
    .map(|(name, introduced_in)| (name.to_string(), introduced_in.to_string()))
    .collect();

  all_offenses.sort_by(|a, b| {
    let file_comparison = a.filename.cmp(&b.filename);

    if file_comparison != std::cmp::Ordering::Equal {
      return file_comparison;
    }

    let line_comparison = a.offense.location.start.line.cmp(&b.offense.location.start.line);

    if line_comparison != std::cmp::Ordering::Equal {
      return line_comparison;
    }

    a.offense.location.start.column.cmp(&b.offense.location.start.column)
  });

  ProcessingResult {
    files: files.to_vec(),
    all_offenses,
    total_errors,
    total_warnings,
    total_info,
    total_hints,
    files_with_offenses,
    total_ignored,
    total_would_be_ignored,
    rule_count,
    rules_disabled_by_config,
    rules_not_enabled_by_default,
    autofixable_count,
    unsafe_autofixable_count,
    rules_skipped_by_version,
    rule_offenses,
  }
}

pub(crate) fn meets_severity_threshold(severity: &Severity, level: &FailLevel) -> bool {
  let rank = |severity: &Severity| match severity {
    Severity::Error => 3,
    Severity::Warning => 2,
    Severity::Info => 1,
    Severity::Hint => 0,
  };

  let threshold = match level {
    FailLevel::Error => 3,
    FailLevel::Warning => 2,
    FailLevel::Info => 1,
    FailLevel::Hint => 0,
  };

  rank(severity) >= threshold
}

pub(crate) fn print_fix_diff(file_path: &str, before: &str, after: &str) {
  let no_color = std::env::var("NO_COLOR").is_ok();
  let removed = |text: &str| if no_color { format!("-{text}") } else { format!("\x1b[31m-{text}\x1b[0m") };
  let added = |text: &str| if no_color { format!("+{text}") } else { format!("\x1b[32m+{text}\x1b[0m") };

  let before_lines: Vec<&str> = before.lines().collect();
  let after_lines: Vec<&str> = after.lines().collect();

  println!();
  println!("{file_path}");

  for index in 0..before_lines.len().max(after_lines.len()) {
    let old_line = before_lines.get(index).copied();
    let new_line = after_lines.get(index).copied();

    if old_line == new_line {
      continue;
    }

    if let Some(old_line) = old_line {
      println!("  {}", removed(old_line));
    }

    if let Some(new_line) = new_line {
      println!("  {}", added(new_line));
    }
  }
}
