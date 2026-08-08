use crate::cli::argument_parser::{CliArguments, OutputFormat};
use crate::cli::file_processor::ProcessingResult;
use crate::cli::formatters::{format_github_actions, format_json, format_simple};
use crate::cli::summary_reporter::{display_most_violated_rules, display_no_enabled_rules, display_summary, SummaryContext};

pub(crate) fn output_results(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext, duration: std::time::Duration) {
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

pub(crate) fn output_info(message: &str, arguments: &CliArguments) {
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

pub(crate) fn output_progress(message: &str, arguments: &CliArguments) {
  if arguments.github_actions || arguments.format == OutputFormat::Json {
    return;
  }

  if std::env::var("NO_COLOR").is_ok() {
    eprintln!("{}", message);
  } else {
    eprintln!("\x1b[90m{}\x1b[0m", message);
  }
}

pub(crate) fn output_error(message: &str, arguments: &CliArguments) {
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
