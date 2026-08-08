use crate::*;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum OutputFormat {
  Simple,
  Detailed,
  Json,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum FailLevel {
  Error,
  Warning,
  Info,
  Hint,
}

impl FailLevel {
  pub(crate) fn severity(&self) -> Severity {
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
pub(crate) struct CliArguments {
  pub(crate) patterns: Vec<String>,
  pub(crate) format: OutputFormat,
  pub(crate) fail_level: FailLevel,
  pub(crate) fail_level_explicit: bool,
  pub(crate) config_file: Option<String>,
  pub(crate) fix: bool,
  pub(crate) fix_unsafe: bool,
  pub(crate) ignore_disable_comments: bool,
  pub(crate) force: bool,
  pub(crate) init: bool,
  pub(crate) github_actions: bool,
  pub(crate) no_color: bool,
  pub(crate) show_timing: bool,
  pub(crate) show_rules: bool,
  pub(crate) upgrade: bool,
  pub(crate) disable_failing: bool,
  pub(crate) show_fix_diff: bool,
  pub(crate) only_rules: Vec<String>,
  pub(crate) all_rules: bool,
  pub(crate) log_level: Option<FailLevel>,
}

pub(crate) fn split_inline_values(arguments: impl Iterator<Item = String>) -> Vec<String> {
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

pub(crate) fn parse_arguments() -> CliArguments {
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
  let mut upgrade = false;
  let mut disable_failing = false;

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
      "--upgrade" => upgrade = true,
      "--disable-failing" => disable_failing = true,
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
    upgrade,
    disable_failing,
    show_fix_diff,
    only_rules,
    all_rules,
    log_level,
  }
}

pub(crate) fn print_usage() {
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
  println!("  --upgrade                     update the .herb.yml version, enabling new rules that have no offenses");
  println!("  --disable-failing             disable every rule that currently reports an offense in .herb.yml");
  println!("  --all-rules                   run every rule, ignoring config and defaults");
  println!("  --show-fix-diff               show what `--fix` would change, without writing");
  println!("  --log-level <severity>        hide offenses below this severity (error|warning|info|hint)");
}
