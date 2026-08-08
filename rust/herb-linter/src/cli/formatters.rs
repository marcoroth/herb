use crate::cli::argument_parser::CliArguments;
use crate::cli::file_processor::ProcessingResult;

pub(crate) fn format_simple(result: &ProcessingResult) {
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

pub(crate) fn format_json(result: &ProcessingResult, arguments: &CliArguments, duration: std::time::Duration) {
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
        "source": processed.offense.source,
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
      "totalIgnored": result.total_ignored,
      "totalOffenses": result.total_errors + result.total_warnings,
      "totalNotReported": 0,
      "ruleCount": result.rule_count,
    },
    "timing": timing,
    "completed": true,
    "clean": result.total_errors == 0 && result.total_warnings == 0,
    "message": serde_json::Value::Null,
  });

  println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

pub(crate) fn format_github_actions(result: &ProcessingResult) {
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

pub(crate) fn escape_github_message(input: &str) -> String {
  input.replace('%', "%25").replace('\n', "%0A").replace('\r', "%0D")
}

pub(crate) fn escape_github_param(input: &str) -> String {
  input
    .replace('%', "%25")
    .replace('\n', "%0A")
    .replace('\r', "%0D")
    .replace(':', "%3A")
    .replace(',', "%2C")
}
