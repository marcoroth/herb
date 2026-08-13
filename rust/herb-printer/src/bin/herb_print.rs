use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use colored::Colorize;
use herb::ParserOptions;
use herb_config::{Config, Tool};
use herb_printer::IdentityPrinter;
use rayon::prelude::*;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Default)]
struct CLIOptions {
  input: Option<String>,
  output: Option<String>,
  config_file: Option<String>,
  verify: bool,
  stats: bool,
  help: bool,
  glob: bool,
  force: bool,
  verbose: bool,
}

enum Outcome {
  ReadError(String),
  PrintError(String),
  Printed { matched: bool, bytes: usize },
}

fn main() {
  std::process::exit(run());
}

fn run() -> i32 {
  let options = parse_args(env::args().collect());

  if options.help || (options.input.is_none() && !options.glob) {
    show_help();
    return 0;
  }

  let current_directory = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  let start_path = options.input.clone().unwrap_or_else(|| current_directory.to_string_lossy().to_string());
  let config_path = options.config_file.clone().unwrap_or(start_path);

  let config = match Config::load(Path::new(&config_path), Some(VERSION)) {
    Ok(config) => config,
    Err(error) => {
      eprintln!("Error: {error}");

      return 1;
    }
  };

  if options.glob {
    run_glob(&options, &config, &current_directory)
  } else {
    run_single(&options, &config, &current_directory)
  }
}

fn run_glob(options: &CLIOptions, config: &Config, current_directory: &Path) -> i32 {
  let files_config = config.get_files_config_for_tool(Tool::Linter);
  let exclude = files_config.exclude.clone().unwrap_or_default();

  let files = match &options.input {
    Some(input) => config.glob_files(std::slice::from_ref(input), current_directory, &exclude),
    None => config.find_files_for_linter(Some(current_directory)),
  };

  if files.is_empty() {
    let pattern = options.input.clone().unwrap_or_else(|| "configured patterns".to_string());
    eprintln!("No files found matching: {pattern}");
    return 1;
  }

  let mut total_files = 0;
  let mut failed_files = 0;
  let mut verification_failures = 0;
  let mut total_bytes = 0;

  println!("Processing {} files...\n", files.len());

  let outcomes: Vec<Outcome> = files
    .par_iter()
    .map(|file| match fs::read_to_string(file) {
      Err(error) => Outcome::ReadError(error.to_string()),
      Ok(input) => match print_source(&input) {
        Err(error) => Outcome::PrintError(error),
        Ok(output) => Outcome::Printed {
          matched: input == output,
          bytes: input.len(),
        },
      },
    })
    .collect();

  for (file, outcome) in files.iter().zip(&outcomes) {
    match outcome {
      Outcome::ReadError(error) => {
        eprintln!("{} {}: {} - {error}", "✗".red(), file.bold(), "Error".red().bold());
        failed_files += 1;
      }

      Outcome::PrintError(error) => {
        eprintln!("{} {}: {} - {error}", "✗".red(), file.bold(), "Failed".red().bold());
        failed_files += 1;
      }

      Outcome::Printed { matched, bytes } => {
        total_files += 1;
        total_bytes += bytes;

        if options.verify {
          if *matched {
            if options.verbose {
              println!("{} {}: {}", "✓".green(), file.bold(), "Perfect match".green());
            }
          } else {
            eprintln!("{} {}: {} - differences detected", "✗".red(), file.bold(), "Verification failed".red().bold());
            verification_failures += 1;
          }
        } else if options.verbose {
          println!("{} {}: {}", "✓".green(), file.bold(), "Processed".green());
        }
      }
    }
  }

  println!("\nSummary:");
  println!("  Files processed: {total_files}");
  println!("  Files failed:    {failed_files}");

  if options.verify {
    println!(
      "  Verifications:    {} passed, {verification_failures} failed",
      total_files - verification_failures
    );
  }

  if options.stats {
    println!("  Total bytes:      {total_bytes}");
  }

  if failed_files > 0 || verification_failures > 0 {
    1
  } else {
    0
  }
}

fn run_single(options: &CLIOptions, config: &Config, current_directory: &Path) -> i32 {
  let input_arg = options.input.clone().expect("input is present in single-file mode");
  let input_path = PathBuf::from(&input_arg);

  let files_config = config.get_files_config_for_tool(Tool::Linter);
  let exclude = files_config.exclude.clone().unwrap_or_default();
  let matched = config.glob_files(std::slice::from_ref(&input_arg), current_directory, &exclude);

  if matched.is_empty() && input_path.exists() {
    if !options.force {
      eprintln!("⚠️  File {input_arg} is excluded by configuration patterns.");
      eprintln!("   Use --force to print it anyway.\n");
      return 0;
    }

    eprintln!("⚠️  Forcing printer on excluded file: {input_arg}");
    eprintln!();
  }

  let input = match fs::read_to_string(&input_path) {
    Ok(input) => input,
    Err(error) => {
      eprintln!("Error: {error}");
      return 1;
    }
  };

  let options_parser = ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  let parse_result = match herb::parse_with_options(&input, &options_parser) {
    Ok(result) => result,
    Err(error) => {
      eprintln!("Error: {error}");
      return 1;
    }
  };

  if !parse_result.errors().is_empty() {
    let messages: Vec<&str> = parse_result.errors().iter().map(|error| error.message()).collect();
    eprintln!("Parse errors: {}", messages.join(", "));
    return 1;
  }

  let output = IdentityPrinter::print_document(&parse_result.value);

  if let Some(output_arg) = &options.output {
    let output_path = PathBuf::from(output_arg);

    if let Err(error) = fs::write(&output_path, &output) {
      eprintln!("Error: {error}");
      return 1;
    }

    println!("Output written to: {}", output_path.display());
  } else {
    println!("{output}");
  }

  if options.verify {
    if input == output {
      eprintln!("{} - output matches input exactly", "✓ Verification passed".green());
    } else {
      eprintln!("{} - output differs from input", "✗ Verification failed".red());

      return 1;
    }
  }

  if options.stats {
    let errors = parse_result.errors().len();
    let round_trip = if input == output { "Perfect" } else { "Differences detected" };

    eprintln!("Printing Statistics:");
    eprintln!("  Input size:     {} bytes", input.len());
    eprintln!("  Output size:    {} bytes", output.len());
    eprintln!("  Parse errors:   {errors}");
    eprintln!("  Round-trip:     {round_trip}");
  }

  0
}

fn print_source(input: &str) -> Result<String, String> {
  let options = ParserOptions {
    track_whitespace: true,
    ..Default::default()
  };

  let parse_result = herb::parse_with_options(input, &options).map_err(|error| error.to_string())?;

  if !parse_result.recursive_errors().is_empty() {
    return Err("to parse".to_string());
  }

  Ok(IdentityPrinter::print_document(&parse_result.value))
}

fn parse_args(args: Vec<String>) -> CLIOptions {
  let mut options = CLIOptions::default();
  let mut index = 1;

  while index < args.len() {
    let arg = &args[index];

    match arg.as_str() {
      "-i" | "--input" => {
        index += 1;
        options.input = args.get(index).cloned();
      }

      "-o" | "--output" => {
        index += 1;
        options.output = args.get(index).cloned();
      }

      "--config-file" => {
        index += 1;
        options.config_file = args.get(index).cloned();
      }

      "--verify" => options.verify = true,
      "--stats" => options.stats = true,
      "--glob" => options.glob = true,
      "--force" => options.force = true,
      "--verbose" => options.verbose = true,
      "-h" | "--help" => options.help = true,

      _ => {
        if !arg.starts_with('-') && options.input.is_none() {
          options.input = Some(arg.clone());
        }
      }
    }

    index += 1;
  }

  options
}

fn show_help() {
  println!(
    "herb-print - Print HTML+ERB AST back to source code

This tool parses HTML+ERB templates and prints them back, preserving the original
formatting as closely as possible. Useful for testing parser accuracy and as a
baseline for other transformations.

Usage:
  herb-print [options] <input-file-or-pattern>
  herb-print -i <input-file> -o <output-file>

Options:
  -i, --input <file>           Input file path
  -o, --output <file>          Output file path (defaults to stdout)
  --config-file <path>         Explicitly specify path to .herb.yml config file
  --verify                     Verify that output matches input exactly
  --stats                      Show parsing and printing statistics
  --glob                       Treat input as glob pattern
  --force                      Process files even if excluded by configuration
  --verbose                    Print a line for every file, not just failures
  -h, --help                   Show this help message

Examples:
  # Single file
  herb-print input.html.erb > output.html.erb
  herb-print -i input.html.erb -o output.html.erb --verify
  herb-print input.html.erb --stats

  # Glob patterns (batch verification)
  herb-print --glob --verify                         # All configured files
  herb-print \"app/views/**/*.html.erb\" --glob --verify --stats
  herb-print \"*.erb\" --glob --verify

  # The --verify flag is useful to test parser fidelity:
  herb-print input.html.erb --verify"
  );
}
