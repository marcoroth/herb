use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;

use herb_config::{Config, Severity, Tool};
use herb_linter::linter::Linter;
use herb_linter::offense::Offense;
use herb_linter::partial_index_builder::{build_partial_index, refresh_partial_after_fix};
mod cli;

use cli::argument_parser::{parse_arguments, FailLevel};
use cli::commands::{disable_failing_command, init_command, rules_command, upgrade_command};
use cli::file_processor::{determine_project_path, lint_files, meets_severity_threshold, resolve_pattern_to_files, ProcessingResult};
use cli::output_manager::{output_error, output_info, output_progress, output_results};
use cli::summary_reporter::{display_tips, lowered_log_level, SummaryContext};

use herb_linter::rule::LintContext;
use herb_linter::urls::{rule_documentation_url, RULE_CONFIGURATION_DOCUMENTATION_URL};

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

  if arguments.upgrade {
    upgrade_command(&project_path, &arguments);
  }

  if arguments.disable_failing {
    disable_failing_command(&project_path, &arguments);
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
