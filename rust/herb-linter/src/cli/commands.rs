use crate::cli::argument_parser::CliArguments;
use crate::cli::file_processor::{lint_files, ProcessingResult};
use crate::cli::summary_reporter::{pluralize, Paint};
use crate::*;

pub(crate) const TOOL_VERSION: &str = env!("CARGO_PKG_VERSION");
pub(crate) const PROTECTED_RULES: &[&str] = &["parser-no-errors"];

pub(crate) fn require_config(project_path: &Path, config_file: &Option<String>) -> (Config, PathBuf) {
  let paint = Paint::new();
  let load_path = match config_file {
    Some(config_file) => PathBuf::from(config_file),
    None => project_path.to_path_buf(),
  };

  if !Config::exists(&load_path) {
    eprintln!("\n\u{2717} No .herb.yml found. Run {} first.\n", paint.cyan("herb-lint --init"));
    std::process::exit(1);
  }

  match Config::load(&load_path, None) {
    Ok(config) => {
      let path = config.path.clone();
      (config, path)
    }
    Err(error) => {
      eprintln!("Error: {}", error);
      std::process::exit(1);
    }
  }
}

pub(crate) fn offense_counts_by_rule(result: &ProcessingResult, skip_protected: bool) -> Vec<(String, usize)> {
  let mut counts: Vec<(String, usize)> = Vec::new();

  for processed in &result.all_offenses {
    if !matches!(processed.offense.severity, Severity::Error | Severity::Warning) {
      continue;
    }

    if skip_protected && PROTECTED_RULES.contains(&processed.offense.rule.as_str()) {
      continue;
    }

    match counts.iter_mut().find(|(rule, _)| *rule == processed.offense.rule) {
      Some((_, count)) => *count += 1,
      None => counts.push((processed.offense.rule.clone(), 1)),
    }
  }

  counts
}

pub(crate) fn disable_rules(config_path: &Path, rule_names: &[String]) {
  let rules: HashMap<String, herb_config::RuleConfig> = rule_names
    .iter()
    .map(|name| {
      (
        name.clone(),
        herb_config::RuleConfig {
          enabled: Some(false),
          ..Default::default()
        },
      )
    })
    .collect();

  let mutation = herb_config::HerbConfigOptions {
    linter: Some(herb_config::LinterConfig {
      rules: Some(rules),
      ..Default::default()
    }),
    ..Default::default()
  };

  if let Err(error) = herb_config::mutate_config_file(config_path, &mutation, None) {
    eprintln!("Error: failed to update {}: {}", config_path.display(), error);
    std::process::exit(1);
  }
}

pub(crate) fn write_config_version(config_path: &Path, version: &str) {
  let contents = match std::fs::read_to_string(config_path) {
    Ok(contents) => contents,
    Err(error) => {
      eprintln!("Error: failed to read {}: {}", config_path.display(), error);
      std::process::exit(1);
    }
  };

  let updated: Vec<String> = contents
    .lines()
    .map(|line| {
      if line.starts_with("version:") {
        format!("version: {version}")
      } else {
        line.to_string()
      }
    })
    .collect();

  let mut output = updated.join("\n");

  if contents.ends_with('\n') {
    output.push('\n');
  }

  if let Err(error) = std::fs::write(config_path, output) {
    eprintln!("Error: failed to write {}: {}", config_path.display(), error);
    std::process::exit(1);
  }
}

pub(crate) fn lint_for_command(config: &Config, project_path: &Path, arguments: &CliArguments) -> ProcessingResult {
  let files = config.find_files_for_linter(Some(project_path));

  lint_files(&files, project_path, config, false, false, arguments.ignore_disable_comments, &[], false, false)
}

pub(crate) fn upgrade_command(project_path: &Path, arguments: &CliArguments) {
  let paint = Paint::new();
  let (config, config_path) = require_config(project_path, &arguments.config_file);
  let config_version = config.config_version.clone();

  if config_version.as_deref() == Some(TOOL_VERSION) {
    println!("\n\u{2713} Your .herb.yml is already at version {TOOL_VERSION}. Nothing to upgrade.\n");
    std::process::exit(0);
  }

  let skipped: Vec<String> = Linter::new(config.clone())
    .rules_skipped_by_version()
    .into_iter()
    .map(|(name, _)| name.to_string())
    .collect();

  let mut to_enable: Vec<String> = Vec::new();
  let mut to_disable: Vec<(String, usize)> = Vec::new();

  if !skipped.is_empty() {
    println!(
      "\n{} Checking {} new {} against your codebase...",
      paint.cyan("\u{21bb}"),
      paint.bold(&skipped.len().to_string()),
      pluralize(skipped.len(), "rule")
    );

    let result = lint_files(
      &config.find_files_for_linter(Some(project_path)),
      project_path,
      &config,
      false,
      false,
      arguments.ignore_disable_comments,
      &skipped,
      false,
      false,
    );

    let counts = offense_counts_by_rule(&result, false);

    for rule in &skipped {
      match counts.iter().find(|(name, _)| name == rule) {
        Some((_, count)) => to_disable.push((rule.clone(), *count)),
        None => to_enable.push(rule.clone()),
      }
    }

    to_enable.sort();
    to_disable.sort_by(|left, right| left.0.cmp(&right.0));

    if !to_disable.is_empty() {
      let names: Vec<String> = to_disable.iter().map(|(name, _)| name.clone()).collect();

      disable_rules(&config_path, &names);
    }
  }

  write_config_version(&config_path, TOOL_VERSION);

  println!(
    "\n{} Updated {} version from {} to {}",
    paint.code("92", "\u{2713}"),
    paint.cyan(".herb.yml"),
    paint.cyan(config_version.as_deref().unwrap_or("unversioned")),
    paint.cyan(TOOL_VERSION)
  );

  if !to_enable.is_empty() {
    println!(
      "\n{} Enabled {} new {} (no offenses found):\n",
      paint.code("92", "\u{2713}"),
      paint.bold(&to_enable.len().to_string()),
      pluralize(to_enable.len(), "rule")
    );

    for rule in &to_enable {
      println!("  {} {}", paint.code("92", "\u{2713}"), paint.white(rule));
    }
  }

  if !to_disable.is_empty() {
    let total: usize = to_disable.iter().map(|(_, count)| count).sum();

    println!(
      "\n{} Found {} {} across {} new {}. Disabled to ease the upgrade:\n",
      paint.code("33", "!"),
      paint.bold(&total.to_string()),
      pluralize(total, "offense"),
      paint.bold(&to_disable.len().to_string()),
      pluralize(to_disable.len(), "rule")
    );

    for (rule, count) in &to_disable {
      println!(
        "  {} {} {}",
        paint.code("31", "\u{2717}"),
        paint.white(rule),
        paint.gray(&format!("({} {})", count, pluralize(*count, "offense")))
      );
    }

    println!(
      "\n  When you're ready, review the disabled {} in your {} and re-enable them after fixing the offenses.",
      pluralize(to_disable.len(), "rule"),
      paint.cyan(".herb.yml")
    );
  }

  if skipped.is_empty() {
    println!("\n{} No new rules to configure.", paint.code("92", "\u{2713}"));
  }

  println!();
  std::process::exit(0);
}

pub(crate) fn disable_failing_command(project_path: &Path, arguments: &CliArguments) {
  let paint = Paint::new();
  let (config, config_path) = require_config(project_path, &arguments.config_file);

  println!("\n{} Linting codebase to find rules with offenses...", paint.cyan("\u{21bb}"));

  let result = lint_for_command(&config, project_path, arguments);
  let mut failing = offense_counts_by_rule(&result, true);

  if failing.is_empty() {
    println!("\n{} No offenses found. All rules are passing!\n", paint.code("92", "\u{2713}"));
    std::process::exit(0);
  }

  let names: Vec<String> = failing.iter().map(|(name, _)| name.clone()).collect();

  disable_rules(&config_path, &names);

  let total: usize = failing.iter().map(|(_, count)| count).sum();

  failing.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

  println!(
    "\n{} Found {} {} across {} {}. Disabled in {}:\n",
    paint.code("33", "!"),
    paint.bold(&total.to_string()),
    pluralize(total, "offense"),
    paint.bold(&failing.len().to_string()),
    pluralize(failing.len(), "rule"),
    paint.cyan(".herb.yml")
  );

  for (rule, count) in &failing {
    println!(
      "  {} {} {}",
      paint.code("31", "\u{2717}"),
      paint.white(rule),
      paint.gray(&format!("({} {})", count, pluralize(*count, "offense")))
    );
  }

  println!(
    "\n  When you're ready, review the disabled rules in your {} and re-enable them after fixing the offenses.\n",
    paint.cyan(".herb.yml")
  );

  std::process::exit(0);
}

pub(crate) fn init_command(current_directory: &Path, existing_config: Option<PathBuf>) {
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

pub(crate) fn rules_command() {
  let linter = Linter::default();
  let names = linter.rule_names();

  println!("{} rules available:\n", names.len());
  for name in names {
    println!("  {}", name);
  }
}
