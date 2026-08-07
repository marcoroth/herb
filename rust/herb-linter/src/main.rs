use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use herb_config::{Config, Severity, Tool};
use herb_linter::linter::Linter;
use herb_linter::offense::Offense;
use herb_linter::partial_index_builder::{build_partial_index, refresh_partial_after_fix};
use herb_linter::rule::LintContext;

#[derive(Debug, Clone, PartialEq)]
enum OutputFormat {
  Simple,
  Detailed,
  Json,
}

#[derive(Debug, Clone, PartialEq)]
enum FailLevel {
  Error,
  Warning,
  Info,
  Hint,
}

impl FailLevel {
  fn severity(&self) -> Severity {
    match self {
      FailLevel::Error => Severity::Error,
      FailLevel::Warning => Severity::Warning,
      FailLevel::Info => Severity::Info,
      FailLevel::Hint => Severity::Hint,
    }
  }
}

#[derive(Debug)]
#[allow(dead_code)]
struct CliArguments {
  patterns: Vec<String>,
  format: OutputFormat,
  fail_level: FailLevel,
  fail_level_explicit: bool,
  config_file: Option<String>,
  fix: bool,
  fix_unsafe: bool,
  ignore_disable_comments: bool,
  force: bool,
  init: bool,
  github_actions: bool,
  no_color: bool,
  show_timing: bool,
  show_rules: bool,
  show_fix_diff: bool,
  only_rules: Vec<String>,
  all_rules: bool,
  log_level: Option<FailLevel>,
}

struct ProcessedFile {
  filename: String,
  offense: Offense,
}

struct RuleOffenseStats {
  count: usize,
  files: HashSet<String>,
}

struct ProcessingResult {
  files: Vec<String>,
  all_offenses: Vec<ProcessedFile>,
  total_errors: usize,
  total_warnings: usize,
  total_info: usize,
  total_hints: usize,
  files_with_offenses: usize,
  total_ignored: usize,
  total_would_be_ignored: usize,
  rule_count: usize,
  rules_disabled_by_config: usize,
  rules_not_enabled_by_default: usize,
  autofixable_count: usize,
  unsafe_autofixable_count: usize,
  rules_skipped_by_version: Vec<(String, String)>,
  rule_offenses: Vec<(String, RuleOffenseStats)>,
}

fn main() {
  let arguments = parse_arguments();

  if arguments.show_rules {
    rules_command();
    return;
  }

  let current_directory = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  let project_path = determine_project_path(&arguments.patterns, &current_directory);

  let load_path = match arguments.config_file {
    Some(ref config_file) => PathBuf::from(config_file),
    None => project_path.clone(),
  };

  let config = match Config::load(&load_path, None) {
    Ok(config) => config,
    Err(error) => {
      eprintln!("Error: {}", error);
      std::process::exit(1);
    }
  };

  if arguments.init {
    init_command(
      &current_directory,
      Config::exists(&project_path).then(|| Config::config_path_from_project_path(&project_path)),
    );
    return;
  }

  if !config.is_linter_enabled() && !arguments.force {
    output_info("Linting is disabled in .herb.yml configuration. Use --force to lint anyway.", &arguments);
    return;
  }

  let start_time = Instant::now();

  let fail_level = if arguments.fail_level_explicit {
    arguments.fail_level.clone()
  } else if let Some(config_level) = config.linter().and_then(|linter| linter.fail_level) {
    match config_level {
      Severity::Error => FailLevel::Error,
      Severity::Warning => FailLevel::Warning,
      Severity::Info => FailLevel::Info,
      Severity::Hint => FailLevel::Hint,
    }
  } else {
    arguments.fail_level.clone()
  };

  let mut explicit_files: Vec<String> = Vec::new();

  let all_files = if arguments.patterns.is_empty() {
    config.find_files_for_linter(Some(&project_path))
  } else {
    let mut collected: Vec<String> = Vec::new();

    for pattern in &arguments.patterns {
      let (pattern_files, explicit_file) = resolve_pattern_to_files(pattern, &config, &project_path, arguments.force, &arguments);

      if pattern_files.is_empty() {
        output_error(&format!("✗ No files found matching pattern: {}", pattern), &arguments);
        std::process::exit(1);
      }

      for file in pattern_files {
        if !collected.contains(&file) {
          collected.push(file);
        }
      }

      if let Some(explicit_file) = explicit_file {
        explicit_files.push(explicit_file);
      }
    }

    collected
  };

  if all_files.is_empty() {
    output_info("No matching files found", &arguments);
    return;
  }

  if all_files.len() > 1 {
    output_progress(&format!("Found {} files, linting...", all_files.len()), &arguments);
  }

  let mut processing_config = config;

  if arguments.force && !explicit_files.is_empty() {
    if let Some(linter) = processing_config.config.linter.as_mut() {
      linter.exclude = Some(Vec::new());
    }
  }

  let result = lint_files(
    &all_files,
    &project_path,
    &processing_config,
    arguments.fix,
    arguments.fix_unsafe,
    arguments.ignore_disable_comments,
    &arguments.only_rules,
    arguments.all_rules,
    arguments.show_fix_diff,
  );
  let duration = start_time.elapsed();

  let result = match &arguments.log_level {
    // hides quieter offenses from the report without changing the counts
    Some(level) => ProcessingResult {
      all_offenses: result
        .all_offenses
        .into_iter()
        .filter(|processed| meets_severity_threshold(&processed.offense.severity, level))
        .collect(),
      ..result
    },
    None => result,
  };

  let has_config_file = Config::exists(&project_path);
  let effective_log_level = arguments.log_level.clone().unwrap_or(FailLevel::Hint);
  let lowered = lowered_log_level(&result, &effective_log_level, &arguments);

  let summary_context = SummaryContext {
    fail_level: fail_level.clone(),
    log_level: lowered.as_ref().map(|(severity, _)| severity.clone()).unwrap_or(effective_log_level.clone()),
    log_level_lowered_from: lowered.as_ref().map(|_| effective_log_level.clone()),
    log_level_lowered_by: lowered.as_ref().map(|(_, flag)| *flag),
    config_version: processing_config.config_version.clone(),
    config_path: has_config_file.then(|| processing_config.path.to_string_lossy().into_owned()),
    has_config_file,
  };

  output_results(&result, &arguments, &summary_context, duration);
  display_tips(&result, &arguments, &summary_context);

  let should_fail = match fail_level {
    FailLevel::Error => result.total_errors > 0,
    FailLevel::Warning => result.total_errors > 0 || result.total_warnings > 0,
    FailLevel::Info => result.total_errors > 0 || result.total_warnings > 0 || result.total_info > 0,
    FailLevel::Hint => result.total_errors > 0 || result.total_warnings > 0 || result.total_info > 0 || result.total_hints > 0,
  };

  if should_fail {
    std::process::exit(1);
  }
}

fn split_inline_values(arguments: impl Iterator<Item = String>) -> Vec<String> {
  let mut values = Vec::new();

  for argument in arguments {
    match argument.split_once('=') {
      Some((name, value)) if name.starts_with("--") && !name.is_empty() => {
        values.push(name.to_string());
        values.push(value.to_string());
      }
      _ => values.push(argument),
    }
  }

  values
}

fn parse_arguments() -> CliArguments {
  let argument_values: Vec<String> = split_inline_values(std::env::args());

  let mut patterns = Vec::new();
  let mut format = OutputFormat::Detailed;
  let mut fail_level = FailLevel::Error;
  let mut fail_level_explicit = false;
  let mut config_file = None;
  let mut fix = false;
  let mut fix_unsafe = false;
  let mut ignore_disable_comments = false;
  let mut force = false;
  let mut init = false;
  let mut github_actions_flag: Option<bool> = None;
  let mut no_color = false;
  let mut show_timing = true;
  let mut show_fix_diff = false;
  let mut only_rules: Vec<String> = Vec::new();
  let mut all_rules = false;
  let mut log_level: Option<FailLevel> = None;
  let mut show_rules = false;

  let mut index = 1;
  while index < argument_values.len() {
    let argument = &argument_values[index];

    match argument.as_str() {
      "-h" | "--help" => {
        print_usage();
        std::process::exit(0);
      }
      "-v" | "--version" => {
        println!("herb-lint {}", env!("CARGO_PKG_VERSION"));
        std::process::exit(0);
      }
      "--init" => init = true,
      "-c" | "--config-file" => {
        index += 1;
        if index >= argument_values.len() {
          eprintln!("Error: --config-file requires a path argument");
          std::process::exit(1);
        }
        config_file = Some(argument_values[index].clone());
      }
      "--force" => force = true,
      "--fix" => fix = true,
      "--fix-unsafely" => {
        fix_unsafe = true;
        fix = true;
      }
      "--ignore-disable-comments" => ignore_disable_comments = true,
      "--fail-level" => {
        index += 1;
        if index >= argument_values.len() {
          eprintln!("Error: --fail-level requires a severity argument (error|warning|info|hint)");
          std::process::exit(1);
        }
        fail_level_explicit = true;
        fail_level = match argument_values[index].as_str() {
          "error" => FailLevel::Error,
          "warning" => FailLevel::Warning,
          "info" => FailLevel::Info,
          "hint" => FailLevel::Hint,
          other => {
            eprintln!("Error: Invalid --fail-level value \"{}\". Must be one of: error, warning, info, hint", other);
            std::process::exit(1);
          }
        };
      }
      "--format" => {
        index += 1;
        if index >= argument_values.len() {
          eprintln!("Error: --format requires a format argument (simple|detailed|json)");
          std::process::exit(1);
        }
        format = match argument_values[index].as_str() {
          "simple" => OutputFormat::Simple,
          "detailed" => OutputFormat::Detailed,
          "json" => OutputFormat::Json,
          other => {
            eprintln!("Error: Invalid --format value \"{}\". Must be one of: simple, detailed, json", other);
            std::process::exit(1);
          }
        };
      }
      "--simple" => format = OutputFormat::Simple,
      "--json" => format = OutputFormat::Json,
      "--github" => github_actions_flag = Some(true),
      "--no-github" => github_actions_flag = Some(false),
      "--no-color" => no_color = true,
      "--no-timing" => show_timing = false,
      "--all-rules" => all_rules = true,
      "--show-fix-diff" => show_fix_diff = true,
      "--only" => {
        index += 1;

        match argument_values.get(index) {
          Some(value) => only_rules.extend(value.split(',').map(|name| name.trim().to_string()).filter(|name| !name.is_empty())),
          None => {
            eprintln!("Error: --only requires a comma separated list of rule names");
            std::process::exit(1);
          }
        }
      }
      "--log-level" => {
        index += 1;

        match argument_values.get(index).map(|value| value.as_str()) {
          Some("error") => log_level = Some(FailLevel::Error),
          Some("warning") => log_level = Some(FailLevel::Warning),
          Some("info") => log_level = Some(FailLevel::Info),
          Some("hint") => log_level = Some(FailLevel::Hint),
          Some(other) => {
            eprintln!("Error: Invalid --log-level value \"{}\". Must be one of: error, warning, info, hint", other);
            std::process::exit(1);
          }
          None => {
            eprintln!("Error: --log-level requires a severity argument (error|warning|info|hint)");
            std::process::exit(1);
          }
        }
      }
      "--no-wrap-lines" | "--truncate-lines" | "--theme" => {
        if argument == "--theme" {
          index += 1;
        }
      }
      "--no-custom-rules" => {
        // Accept but ignore
      }
      "rules" if index == 1 => show_rules = true,
      _ if argument.starts_with('-') => {
        eprintln!("Error: Unknown option: {}", argument);
        eprintln!("Run with --help for usage information.");
        std::process::exit(1);
      }
      _ => patterns.push(argument.clone()),
    }
    index += 1;
  }

  let is_github_environment = std::env::var("GITHUB_ACTIONS").map_or(false, |value| value == "true");

  let github_actions = match github_actions_flag {
    Some(explicit) => explicit,
    None => is_github_environment,
  };

  if github_actions && format == OutputFormat::Json {
    eprintln!("Error: --github cannot be used with --json format. JSON format is already structured for programmatic consumption.");
    std::process::exit(1);
  }

  if no_color {
    std::env::set_var("NO_COLOR", "1");
  }

  CliArguments {
    patterns,
    format,
    fail_level,
    fail_level_explicit,
    config_file,
    fix,
    fix_unsafe,
    ignore_disable_comments,
    force,
    init,
    github_actions,
    no_color,
    show_timing,
    show_rules,
    show_fix_diff,
    only_rules,
    all_rules,
    log_level,
  }
}

fn print_usage() {
  println!("herb-lint {} - Linter for HTML+ERB templates", env!("CARGO_PKG_VERSION"));
  println!();
  println!("Usage: herb-lint [files|directories...] [options]");
  println!();
  println!("Arguments:");
  println!("  files            Files, directories, or patterns to lint");
  println!("                   Multiple arguments are supported (e.g., herb-lint file1.erb dir/)");
  println!();
  println!("Commands:");
  println!("  rules            List all available lint rules");
  println!();
  println!("Options:");
  println!("  -h, --help                    show help");
  println!("  -v, --version                 show version");
  println!("  -c, --config-file <path>      explicitly specify path to config file");
  println!("  --force                       force linting even if disabled in config");
  println!("  --fix                         automatically fix auto-correctable offenses");
  println!("  --fix-unsafely                also apply unsafe auto-fixes (implies --fix)");
  println!("  --ignore-disable-comments     report offenses even when suppressed with herb:disable comments");
  println!("  --fail-level <severity>       exit with error code for this severity or higher (error|warning|info|hint) [default: error]");
  println!("  --format <format>             output format (simple|detailed|json) [default: detailed]");
  println!("  --simple                      use simple output format (shortcut for --format simple)");
  println!("  --json                        use JSON output format (shortcut for --format json)");
  println!("  --github                      enable GitHub Actions annotations");
  println!("  --no-github                   disable GitHub Actions annotations (even in GitHub Actions environment)");
  println!("  --no-color                    disable colored output");
  println!("  --no-timing                   hide timing information");
  println!("  --only <rules>                run only the given comma separated rules");
  println!("  --all-rules                   run every rule, ignoring config and defaults");
  println!("  --show-fix-diff               show what `--fix` would change, without writing");
  println!("  --log-level <severity>        hide offenses below this severity (error|warning|info|hint)");
}

fn determine_project_path(patterns: &[String], current_directory: &Path) -> PathBuf {
  if let Some(pattern) = patterns.first() {
    let resolved_pattern = current_directory.join(pattern);

    if resolved_pattern.exists() {
      return Config::find_project_root(&resolved_pattern);
    }
  }

  current_directory.to_path_buf()
}

fn adjust_pattern(pattern: &str, config_glob_patterns: &[String], project_path: &Path, current_directory: &Path) -> Vec<String> {
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

fn relative_path(from: &Path, to: &Path) -> String {
  let from = std::fs::canonicalize(from).unwrap_or_else(|_| from.to_path_buf());
  let to = std::fs::canonicalize(to).unwrap_or_else(|_| to.to_path_buf());

  to.strip_prefix(&from)
    .map(|path| path.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/"))
    .unwrap_or_else(|_| to.to_string_lossy().into_owned())
}

fn resolve_pattern_to_files(pattern: &str, config: &Config, project_path: &Path, force: bool, arguments: &CliArguments) -> (Vec<String>, Option<String>) {
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

struct FileLintResult {
  file_path: String,
  offenses: Vec<Offense>,
  errors: usize,
  warnings: usize,
  info: usize,
  hints: usize,
  ignored: usize,
  would_be_ignored: usize,
}

fn refresh_partials(partials: &std::sync::Mutex<std::sync::Arc<herb::action_view_partial_index::PartialIndex>>, file_path: &str, before: &str, after: &str) {
  let mut guard = match partials.lock() {
    Ok(guard) => guard,
    Err(_) => return,
  };

  let mut updated = (**guard).clone();

  if refresh_partial_after_fix(&mut updated, file_path, before, after) {
    *guard = std::sync::Arc::new(updated);
  }
}

fn lint_files(
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

  let file_results: Vec<FileLintResult> = files
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
    .collect();

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
    .filter(|processed| linter.is_rule_autocorrectable(&processed.offense.rule))
    .count();

  let unsafe_autofixable_count = all_offenses
    .iter()
    .filter(|processed| linter.is_rule_unsafe_autocorrectable(&processed.offense.rule))
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

/// Whether an offense is at or above the given severity, so `--log-level`
/// hides the quieter ones.
fn meets_severity_threshold(severity: &Severity, level: &FailLevel) -> bool {
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

/// `--only` and `--all-rules` surface rules that are quieter than the default
/// log level, so the level drops to the quietest severity actually found.
fn lowered_log_level(result: &ProcessingResult, effective: &FailLevel, arguments: &CliArguments) -> Option<(FailLevel, &'static str)> {
  let flag = if !arguments.only_rules.is_empty() {
    "--only"
  } else if arguments.all_rules {
    "--all-rules"
  } else {
    return None;
  };

  if arguments.log_level.is_some() {
    return None;
  }

  let counts = [
    (FailLevel::Error, result.total_errors),
    (FailLevel::Warning, result.total_warnings),
    (FailLevel::Info, result.total_info),
    (FailLevel::Hint, result.total_hints),
  ];

  let lowest = counts.into_iter().rfind(|(_, count)| *count > 0)?;

  if meets_severity_threshold(&lowest.0.severity(), effective) {
    return None;
  }

  Some((lowest.0, flag))
}

const NOT_FAILING_TIP_THRESHOLD: usize = 10;

fn display_tips(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext) {
  if arguments.format == OutputFormat::Json || arguments.github_actions {
    return;
  }

  let paint = Paint::new();

  if !context.has_config_file {
    println!();
    println!(
      " {} Run {} to create a {} and lock the {}.",
      paint.bold("TIP:"),
      paint.cyan("herb-lint --init"),
      paint.cyan(".herb.yml"),
      paint.cyan("version")
    );
    println!(
      "      This ensures upgrading Herb won't enable new rules until you update the {} in {}.",
      paint.cyan("version"),
      paint.cyan(".herb.yml")
    );
  }

  let counts = [
    (Severity::Error, result.total_errors),
    (Severity::Warning, result.total_warnings),
    (Severity::Info, result.total_info),
    (Severity::Hint, result.total_hints),
  ];

  let not_failing: Vec<(Severity, usize)> = counts
    .into_iter()
    .filter(|(severity, count)| *count > 0 && !meets_severity_threshold(severity, &context.fail_level))
    .collect();

  let not_failing_count: usize = not_failing.iter().map(|(_, count)| count).sum();

  if arguments.log_level.is_some() || not_failing_count <= NOT_FAILING_TIP_THRESHOLD {
    return;
  }

  let lowest = match not_failing.last() {
    Some((severity, _)) => severity_label(severity),
    None => return,
  };

  let fail_level = severity_label(&context.fail_level.severity());

  println!();
  println!(
    " {} {} of the logged offenses don't fail the build.",
    paint.bold("TIP:"),
    paint.bold(&not_failing_count.to_string())
  );
  println!(
    "      Run {} to stop logging them, or set {} in your {}.",
    paint.cyan(&format!("herb-lint --log-level={fail_level}")),
    paint.cyan("linter.logLevel"),
    paint.cyan(".herb.yml")
  );
  println!(
    "      To start enforcing them instead, set {} to {} in your {}.",
    paint.cyan("linter.failLevel"),
    paint.cyan(lowest),
    paint.cyan(".herb.yml")
  );
}

fn output_results(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext, duration: std::time::Duration) {
  if arguments.github_actions {
    format_github_actions(result);

    if arguments.format != OutputFormat::Json {
      match arguments.format {
        OutputFormat::Simple | OutputFormat::Detailed => format_simple(result),
        OutputFormat::Json => unreachable!(),
      }
      display_most_violated_rules(result);
      display_summary(result, arguments, context, duration);
      display_no_enabled_rules(result, context);
    }
  } else if arguments.format == OutputFormat::Json {
    format_json(result, arguments, duration);
  } else {
    format_simple(result);
    display_most_violated_rules(result);
    display_summary(result, arguments, context, duration);
    display_no_enabled_rules(result, context);
  }
}

fn output_info(message: &str, arguments: &CliArguments) {
  if arguments.github_actions {
    // GitHub Actions format doesn't output anything for info messages
  } else if arguments.format == OutputFormat::Json {
    let output = serde_json::json!({
      "offenses": [],
      "summary": {
        "filesChecked": 0,
        "filesWithOffenses": 0,
        "totalErrors": 0,
        "totalWarnings": 0,
        "totalInfo": 0,
        "totalHints": 0,
        "totalIgnored": 0,
        "totalOffenses": 0,
        "ruleCount": 0
      },
      "timing": null,
      "completed": false,
      "clean": null,
      "message": message
    });
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
  } else {
    println!("{}", message);
  }
}

fn output_progress(message: &str, arguments: &CliArguments) {
  if arguments.github_actions || arguments.format == OutputFormat::Json {
    return;
  }

  if std::env::var("NO_COLOR").is_ok() {
    eprintln!("{}", message);
  } else {
    eprintln!("\x1b[90m{}\x1b[0m", message);
  }
}

fn output_error(message: &str, arguments: &CliArguments) {
  if arguments.github_actions {
    println!("::error::{}", message);
  } else if arguments.format == OutputFormat::Json {
    let output = serde_json::json!({
      "offenses": [],
      "summary": null,
      "timing": null,
      "completed": false,
      "clean": null,
      "message": message
    });
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
  } else {
    eprintln!("{}", message);
  }
}

fn format_simple(result: &ProcessingResult) {
  if result.all_offenses.is_empty() {
    return;
  }

  let no_color = std::env::var("NO_COLOR").is_ok();
  let mut current_file = String::new();

  for processed in &result.all_offenses {
    if processed.filename != current_file {
      current_file = processed.filename.clone();
      println!();
      if no_color {
        println!("{}:", current_file);
      } else {
        println!("\x1b[36m{}\x1b[0m:", current_file);
      }
    }

    let offense = &processed.offense;
    let location = format!("{}:{}", offense.location.start.line, offense.location.start.column);

    let padded_location = format!("{:<8}", location);
    let severity_string = format!("{}", offense.severity);
    let is_error = severity_string == "error";

    let (severity_symbol, message_line) = if no_color {
      let symbol = if is_error { "x" } else { "!" };
      (
        symbol.to_string(),
        format!("  {} {} {} ({})", padded_location, symbol, offense.message, offense.rule),
      )
    } else {
      let symbol = if is_error {
        "\x1b[91m\u{2717}\x1b[0m" // bright red ✗
      } else {
        "\x1b[93m\u{26a0}\x1b[0m" // bright yellow ⚠
      };

      (
        symbol.to_string(),
        format!("  \x1b[90m{}\x1b[0m {} {} ({})", padded_location, symbol, offense.message, offense.rule),
      )
    };

    let _ = severity_symbol;
    println!("{}", message_line);
  }
}

fn format_json(result: &ProcessingResult, arguments: &CliArguments, duration: std::time::Duration) {
  let offenses: Vec<serde_json::Value> = result
    .all_offenses
    .iter()
    .map(|processed| {
      serde_json::json!({
        "filename": processed.filename,
        "message": processed.offense.message,
        "location": {
          "start": {
            "line": processed.offense.location.start.line,
            "column": processed.offense.location.start.column,
          },
          "end": {
            "line": processed.offense.location.end.line,
            "column": processed.offense.location.end.column,
          }
        },
        "severity": format!("{}", processed.offense.severity),
        "code": processed.offense.rule,
      })
    })
    .collect();

  let timing = if arguments.show_timing {
    Some(serde_json::json!({
      "duration": duration.as_millis(),
    }))
  } else {
    None
  };

  let output = serde_json::json!({
    "offenses": offenses,
    "summary": {
      "filesChecked": result.files.len(),
      "filesWithOffenses": result.files_with_offenses,
      "totalErrors": result.total_errors,
      "totalWarnings": result.total_warnings,
      "totalInfo": result.total_info,
      "totalHints": result.total_hints,
      "totalIgnored": 0,
      "totalOffenses": result.total_errors + result.total_warnings,
      "ruleCount": result.rule_count,
    },
    "timing": timing,
    "completed": true,
    "clean": result.total_errors == 0 && result.total_warnings == 0,
    "message": serde_json::Value::Null,
  });

  println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

fn format_github_actions(result: &ProcessingResult) {
  for processed in &result.all_offenses {
    let offense = &processed.offense;
    let severity_string = format!("{}", offense.severity);

    let level = match severity_string.as_str() {
      "error" => "error",
      "warning" => "warning",
      _ => "notice",
    };

    let escaped_filename = escape_github_param(&processed.filename);
    let mut message = offense.message.clone();
    message.push_str(&format!(" [{}]", offense.rule));
    let escaped_message = escape_github_message(&message);

    let title = format!("{} \u{2022} herb-lint@{}", offense.rule, env!("CARGO_PKG_VERSION"));
    let escaped_title = escape_github_param(&title);

    println!(
      "\n::{}  file={},line={},col={},title={}::{}",
      level, escaped_filename, offense.location.start.line, offense.location.start.column, escaped_title, escaped_message
    );
  }
}

fn escape_github_message(input: &str) -> String {
  input.replace('%', "%25").replace('\n', "%0A").replace('\r', "%0D")
}

fn escape_github_param(input: &str) -> String {
  input
    .replace('%', "%25")
    .replace('\n', "%0A")
    .replace('\r', "%0D")
    .replace(':', "%3A")
    .replace(',', "%2C")
}

/// Every rule being off is easy to do by accident and impossible to notice
/// from a clean report, so say so explicitly.
const RULE_CONFIGURATION_DOCUMENTATION_URL: &str = "https://herb-tools.dev/configuration#setting-the-default-for-all-rules";

fn display_no_enabled_rules(result: &ProcessingResult, context: &SummaryContext) {
  if result.rule_count > 0 {
    return;
  }

  let no_color = std::env::var("NO_COLOR").is_ok();
  let bold = |text: &str| if no_color { text.to_string() } else { format!("\x1b[1m{text}\x1b[0m") };
  let cyan = |text: &str| if no_color { text.to_string() } else { format!("\x1b[36m{text}\x1b[0m") };
  let gray = |text: &str| if no_color { text.to_string() } else { format!("\x1b[90m{text}\x1b[0m") };

  println!();
  println!(" {}", bold("No rules enabled:"));
  println!("  Every linter rule is turned off, so no offenses can be reported.");

  if let Some(config_path) = context.config_path.as_deref() {
    println!("  {} {}", gray("from Herb config:"), cyan(config_path));
  }

  println!();
  println!(
    "  Enable rules under {} in your {}, or run {}",
    cyan("linter.rules"),
    cyan(".herb.yml"),
    cyan("herb-lint --all-rules")
  );
  println!("  to lint with every rule for a single run.");
  println!();
  println!("  {}", gray(RULE_CONFIGURATION_DOCUMENTATION_URL));
}

/// Shows what `--fix` would change, line by line, without touching the file.
fn print_fix_diff(file_path: &str, before: &str, after: &str) {
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

struct SummaryContext {
  fail_level: FailLevel,
  log_level: FailLevel,
  log_level_lowered_from: Option<FailLevel>,
  log_level_lowered_by: Option<&'static str>,
  config_version: Option<String>,
  config_path: Option<String>,
  has_config_file: bool,
}

const DIAGNOSTIC_SEVERITIES: [Severity; 4] = [Severity::Error, Severity::Warning, Severity::Info, Severity::Hint];

fn severity_label(severity: &Severity) -> &'static str {
  match severity {
    Severity::Error => "error",
    Severity::Warning => "warning",
    Severity::Info => "info",
    Severity::Hint => "hint",
  }
}

fn severity_color(severity: &Severity) -> &'static str {
  match severity {
    Severity::Error => "91",
    Severity::Warning => "93",
    Severity::Info => "36",
    Severity::Hint => "90",
  }
}

fn hyperlink(text: &str, url: &str) -> String {
  if std::env::var("NO_COLOR").is_ok() {
    return text.to_string();
  }

  format!("\x1b]8;;{url}\x1b\\{text}\x1b]8;;\x1b\\")
}

struct Paint {
  enabled: bool,
}

impl Paint {
  fn new() -> Self {
    Self {
      enabled: std::env::var("NO_COLOR").is_err(),
    }
  }

  fn code(&self, code: &str, text: &str) -> String {
    if self.enabled {
      format!("\x1b[{code}m{text}\x1b[0m")
    } else {
      text.to_string()
    }
  }

  fn bold(&self, text: &str) -> String {
    self.code("1", text)
  }

  fn gray(&self, text: &str) -> String {
    self.code("90", text)
  }

  fn cyan(&self, text: &str) -> String {
    self.code("36", text)
  }

  fn green(&self, text: &str) -> String {
    self.code("32", text)
  }

  fn white(&self, text: &str) -> String {
    self.code("37", text)
  }

  fn severity(&self, severity: &Severity, text: &str) -> String {
    self.bold(&self.code(severity_color(severity), text))
  }
}

fn severity_part(paint: &Paint, severity: &Severity, count: usize) -> String {
  let label = if matches!(severity, Severity::Info) {
    format!("{count} info")
  } else {
    format!("{} {}", count, pluralize(count, severity_label(severity)))
  };

  paint.severity(severity, &label)
}

fn display_summary(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext, duration: std::time::Duration) {
  let paint = Paint::new();
  let pad = |label: &str| format!("{label:<12}");
  let line = |label: &str, value: &str| println!("  {} {}", paint.gray(&pad(label)), value);

  let counts: HashMap<&'static str, usize> = HashMap::from([
    ("error", result.total_errors),
    ("warning", result.total_warnings),
    ("info", result.total_info),
    ("hint", result.total_hints),
  ]);
  let count_of = |severity: &Severity| counts[severity_label(severity)];

  let failing_severities: Vec<&Severity> = DIAGNOSTIC_SEVERITIES
    .iter()
    .filter(|severity| meets_severity_threshold(severity, &context.fail_level))
    .collect();

  let other_severities: Vec<&Severity> = DIAGNOSTIC_SEVERITIES
    .iter()
    .filter(|severity| !meets_severity_threshold(severity, &context.fail_level))
    .collect();

  let failing_count: usize = failing_severities.iter().map(|severity| count_of(severity)).sum();
  let other_count: usize = other_severities.iter().map(|severity| count_of(severity)).sum();

  let not_reported_count: usize = DIAGNOSTIC_SEVERITIES
    .iter()
    .filter(|severity| !meets_severity_threshold(severity, &context.log_level))
    .map(count_of)
    .sum();

  let files_failing = files_with_severities(result, &failing_severities);
  let files_with_other_offenses_only = result.files_with_offenses.saturating_sub(files_failing);

  println!();
  println!();
  println!(" {}", paint.bold("Summary:"));

  let file_count = result.files.len();
  line("Checked", &paint.cyan(&format!("{} {}", file_count, pluralize(file_count, "file"))));

  if file_count > 1 {
    let files_clean = file_count - result.files_with_offenses;
    let mut file_parts: Vec<String> = Vec::new();

    if files_failing > 0 && files_with_other_offenses_only > 0 {
      file_parts.push(paint.bold(&paint.code("91", &format!("{files_failing} failing"))));
      file_parts.push(paint.bold(&paint.code("93", &format!("{files_with_other_offenses_only} with other offenses"))));
    } else if files_failing > 0 {
      file_parts.push(paint.bold(&paint.code("91", &format!("{files_failing} with offenses"))));
    } else if files_with_other_offenses_only > 0 {
      file_parts.push(paint.bold(&paint.code("93", &format!("{files_with_other_offenses_only} with offenses"))));
    }

    file_parts.push(paint.bold(&paint.green(&format!("{files_clean} clean"))));

    line("Files", &format!("{} {}", file_parts.join(" | "), paint.gray(&format!("({file_count} total)"))));
  }

  let mut parts: Vec<String> = Vec::new();

  for severity in &failing_severities {
    if count_of(severity) > 0 {
      parts.push(severity_part(&paint, severity, count_of(severity)));
    } else if matches!(severity, Severity::Warning) && result.total_errors > 0 {
      parts.push(paint.bold(&paint.green("0 warnings")));
    }
  }

  if other_count == 0 {
    for severity in &other_severities {
      if count_of(severity) > 0 {
        parts.push(severity_part(&paint, severity, count_of(severity)));
      }
    }
  }

  let offenses_summary = if parts.is_empty() {
    paint.bold(&paint.green("0 offenses"))
  } else {
    let mut summary = parts.join(" | ");

    if failing_count > 0 && files_failing > 0 {
      let detail = format!(
        "{} {} across {} {}",
        failing_count,
        pluralize(failing_count, "offense"),
        files_failing,
        pluralize(files_failing, "file")
      );

      summary.push_str(&format!(" {}", paint.gray(&format!("({detail})"))));
    }

    summary
  };

  line(if other_count > 0 { "Failing" } else { "Offenses" }, &offenses_summary);

  if other_count > 0 {
    let other_parts: Vec<String> = other_severities
      .iter()
      .filter(|severity| count_of(severity) > 0)
      .map(|severity| severity_part(&paint, severity, count_of(severity)))
      .collect();

    let files_not_failing = files_with_severities(result, &other_severities);
    let detail = format!(
      "{} {} across {} {}, below --fail-level={}",
      other_count,
      pluralize(other_count, "offense"),
      files_not_failing,
      pluralize(files_not_failing, "file"),
      severity_label(&context.fail_level.severity())
    );

    line("Not failing", &format!("{} {}", other_parts.join(" | "), paint.gray(&format!("({detail})"))));
  }

  if result.total_ignored > 0 {
    let message = format!(
      "{} {} suppressed with herb:disable",
      result.total_ignored,
      pluralize(result.total_ignored, "offense")
    );

    line("Ignored", &paint.bold(&paint.gray(&message)));
  }

  if not_reported_count > 0 {
    let lowest = DIAGNOSTIC_SEVERITIES
      .iter()
      .rfind(|severity| !meets_severity_threshold(severity, &context.log_level) && count_of(severity) > 0);

    if let Some(lowest) = lowest {
      let pronoun = if not_reported_count == 1 { "it" } else { "them" };
      let message = format!(
        "{} {} hidden, show {} with --log-level={}",
        not_reported_count,
        pluralize(not_reported_count, "offense"),
        pronoun,
        severity_label(lowest)
      );

      line("Not shown", &paint.bold(&paint.gray(&message)));
    }
  }

  if let (Some(lowered_from), Some(lowered_by)) = (&context.log_level_lowered_from, context.log_level_lowered_by) {
    let level = paint.severity(&context.log_level.severity(), severity_label(&context.log_level.severity()));
    let reason = paint.cyan(&format!("lowered from {} by {}", severity_label(&lowered_from.severity()), lowered_by));

    line("Log level", &format!("{level} | {reason}"));
  }

  if arguments.ignore_disable_comments && result.total_would_be_ignored > 0 {
    let message = format!(
      "{} additional {} reported (would have been ignored)",
      result.total_would_be_ignored,
      pluralize(result.total_would_be_ignored, "offense")
    );

    line("Note", &paint.bold(&paint.code("96", &message)));
  }

  let total_offenses = failing_count + other_count;
  let fixable_line = if result.autofixable_count > 0 || result.unsafe_autofixable_count > 0 {
    let total_color = if failing_count > 0 { "91" } else { "93" };
    let mut fixable_parts = vec![paint.bold(&paint.code(total_color, &format!("{} {}", total_offenses, pluralize(total_offenses, "offense"))))];

    if result.autofixable_count > 0 {
      fixable_parts.push(paint.bold(&paint.green(&format!("{} autocorrectable using `--fix`", result.autofixable_count))));
    }

    if result.unsafe_autofixable_count > 0 {
      let label = if result.autofixable_count > 0 { "more" } else { "autocorrectable" };

      fixable_parts.push(paint.bold(&paint.code("33", &format!("{} {label} using `--fix-unsafely`", result.unsafe_autofixable_count))));
    }

    fixable_parts.join(" | ")
  } else {
    paint.bold(&paint.gray("0 offenses"))
  };

  line("Fixable", &fixable_line);

  let mut rules_parts = vec![paint.bold(&paint.green(&format!("{} enabled", result.rule_count)))];

  if !arguments.only_rules.is_empty() {
    rules_parts.push(paint.cyan("filtered by --only"));
  }

  if arguments.all_rules {
    rules_parts.push(paint.cyan("all rules via --all-rules"));
  }

  if result.rules_not_enabled_by_default > 0 {
    rules_parts.push(paint.cyan(&format!("{} not enabled", result.rules_not_enabled_by_default)));
  }

  if result.rules_disabled_by_config > 0 {
    rules_parts.push(paint.code("33", &format!("{} disabled", result.rules_disabled_by_config)));
  }

  if !result.rules_skipped_by_version.is_empty() {
    rules_parts.push(paint.gray(&format!("{} skipped (version)", result.rules_skipped_by_version.len())));
  }

  line("Rules", &rules_parts.join(" | "));

  if arguments.show_timing {
    line("Duration", &paint.cyan(&format!("{}ms", duration.as_millis())));
  }

  if result.files_with_offenses == 0 && file_count > 1 {
    println!();
    println!(" {} {}", paint.code("92", "\u{2713}"), paint.green("All files are clean!"));
  }

  display_version_skipped_rules(result, context);
}

fn files_with_severities(result: &ProcessingResult, severities: &[&Severity]) -> usize {
  let mut files: std::collections::HashSet<&str> = std::collections::HashSet::new();

  for processed in &result.all_offenses {
    if severities.iter().any(|severity| **severity == processed.offense.severity) {
      files.insert(processed.filename.as_str());
    }
  }

  files.len()
}

const DOCS_LINTER_BASE_URL: &str = "https://herb-tools.dev/linter/rules";

fn rule_documentation_url(rule_name: &str) -> String {
  format!("{DOCS_LINTER_BASE_URL}/{rule_name}")
}

fn display_version_skipped_rules(result: &ProcessingResult, context: &SummaryContext) {
  if result.rules_skipped_by_version.is_empty() || !context.has_config_file {
    return;
  }

  let paint = Paint::new();
  let config_version = match context.config_version.as_deref() {
    Some(version) => version,
    None => return,
  };

  let rule_count = result.rules_skipped_by_version.len();

  println!();
  println!(" {}", paint.bold("New rules available:"));
  println!(
    "  Your {} version is {}. {} new {} {} disabled to ease upgrades:",
    paint.cyan(".herb.yml"),
    paint.cyan(config_version),
    paint.bold(&rule_count.to_string()),
    pluralize(rule_count, "rule"),
    if rule_count == 1 { "is" } else { "are" }
  );

  if let Some(config_path) = context.config_path.as_deref() {
    println!("  {} {}", paint.gray("from Herb config:"), paint.cyan(config_path));
  }

  println!();

  let mut grouped: Vec<(&str, Vec<&str>)> = Vec::new();

  for (rule_name, introduced_in) in &result.rules_skipped_by_version {
    match grouped.iter_mut().find(|(version, _)| *version == introduced_in.as_str()) {
      Some((_, names)) => names.push(rule_name.as_str()),
      None => grouped.push((introduced_in.as_str(), vec![rule_name.as_str()])),
    }
  }

  grouped.sort_by(|(left, _), (right, _)| {
    if herb_linter::semver::semver_greater_than(right, left) {
      std::cmp::Ordering::Less
    } else if herb_linter::semver::semver_greater_than(left, right) {
      std::cmp::Ordering::Greater
    } else {
      std::cmp::Ordering::Equal
    }
  });

  for (version, mut rule_names) in grouped {
    rule_names.sort_unstable();

    let version_label = if version == herb_linter::semver::UNRELEASED_VERSION {
      "next release"
    } else {
      version
    };

    for rule_name in rule_names {
      println!(
        "  {} {}",
        hyperlink(&paint.white(rule_name), &rule_documentation_url(rule_name)),
        paint.gray(&format!("(introduced in {version_label})"))
      );
    }
  }

  println!();
  println!(
    "  Run {} to update the version. Rules with no offenses will be",
    paint.cyan("herb-lint --upgrade")
  );
  println!("  enabled automatically; rules with offenses will be disabled to ease the upgrade.");
}

fn display_most_violated_rules(result: &ProcessingResult) {
  if result.rule_offenses.is_empty() {
    return;
  }

  let no_color = std::env::var("NO_COLOR").is_ok();
  let limit = 5;

  let mut all_rules: Vec<&(String, RuleOffenseStats)> = result.rule_offenses.iter().collect();
  all_rules.sort_by(|a, b| b.1.count.cmp(&a.1.count));

  let displayed: Vec<_> = all_rules.iter().take(limit).collect();
  let remaining: Vec<_> = all_rules.iter().skip(limit).collect();

  let title = if all_rules.len() <= limit {
    "Rule offenses:"
  } else {
    "Most frequent rule offenses:"
  };

  println!();
  println!();

  if no_color {
    println!(" {}", title);
  } else {
    println!(" \x1b[1m{}\x1b[0m", title);
  }

  for (rule, data) in &displayed {
    let file_count = data.files.len();
    let count_text = format!(
      "({} {} in {} {})",
      data.count,
      pluralize(data.count, "offense"),
      file_count,
      pluralize(file_count, "file")
    );

    if no_color {
      println!("  {} {}", rule, count_text);
    } else {
      println!("  \x1b[37m{}\x1b[0m \x1b[90m{}\x1b[0m", rule, count_text);
    }
  }

  if !remaining.is_empty() {
    let remaining_count: usize = remaining.iter().map(|(_, data)| data.count).sum();
    let remaining_rules = remaining.len();
    let message = format!(
      "  ...and {} more {} with {} {}",
      remaining_rules,
      pluralize(remaining_rules, "rule"),
      remaining_count,
      pluralize(remaining_count, "offense")
    );

    if no_color {
      println!();
      println!("{}", message);
    } else {
      println!();
      println!("\x1b[90m{}\x1b[0m", message);
    }
  }
}

fn init_command(current_directory: &Path, existing_config: Option<PathBuf>) {
  if let Some(path) = existing_config {
    eprintln!("\n\u{2717} Configuration file already exists at {}", path.display());
    eprintln!("  Use --config-file to specify a different location.\n");
    std::process::exit(1);
  }

  let project_root = Config::find_project_root(current_directory);
  let config_path = Config::config_path_from_project_path(&project_root);

  if config_path.exists() {
    eprintln!("\n\u{2717} Configuration file already exists at {}", config_path.display());
    eprintln!("  Use --config-file to specify a different location.\n");
    std::process::exit(1);
  }

  let template = match herb_config::create_config_yaml_string(&herb_config::HerbConfigOptions::default(), None) {
    Ok(template) => template,
    Err(error) => {
      eprintln!("Error: Failed to render configuration template: {}", error);
      std::process::exit(1);
    }
  };

  match std::fs::write(&config_path, template) {
    Ok(()) => {
      println!("\n\u{2713} Configuration initialized at {}", config_path.display());
      println!("  Edit this file to customize linter and formatter settings.\n");
    }
    Err(error) => {
      eprintln!("Error: Failed to write configuration file '{}': {}", config_path.display(), error);
      std::process::exit(1);
    }
  }
}

fn rules_command() {
  let linter = Linter::default();
  let names = linter.rule_names();

  println!("{} rules available:\n", names.len());
  for name in names {
    println!("  {}", name);
  }
}

fn pluralize(count: usize, singular: &str) -> String {
  if count == 1 {
    singular.to_string()
  } else {
    format!("{}s", singular)
  }
}
