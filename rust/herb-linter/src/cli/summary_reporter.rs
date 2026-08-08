use crate::cli::argument_parser::{CliArguments, FailLevel, OutputFormat};
use crate::cli::file_processor::{meets_severity_threshold, ProcessingResult, RuleOffenseStats};
use crate::*;

pub(crate) fn lowered_log_level(result: &ProcessingResult, effective: &FailLevel, arguments: &CliArguments) -> Option<(FailLevel, &'static str)> {
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

pub(crate) const NOT_FAILING_TIP_THRESHOLD: usize = 10;

pub(crate) fn display_tips(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext) {
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

pub(crate) fn display_no_enabled_rules(result: &ProcessingResult, context: &SummaryContext) {
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
  println!("  {}", gray(&RULE_CONFIGURATION_DOCUMENTATION_URL));
}

pub(crate) struct SummaryContext {
  pub(crate) fail_level: FailLevel,
  pub(crate) log_level: FailLevel,
  pub(crate) log_level_lowered_from: Option<FailLevel>,
  pub(crate) log_level_lowered_by: Option<&'static str>,
  pub(crate) config_version: Option<String>,
  pub(crate) config_path: Option<String>,
  pub(crate) has_config_file: bool,
}

pub(crate) const DIAGNOSTIC_SEVERITIES: [Severity; 4] = [Severity::Error, Severity::Warning, Severity::Info, Severity::Hint];

pub(crate) fn severity_label(severity: &Severity) -> &'static str {
  match severity {
    Severity::Error => "error",
    Severity::Warning => "warning",
    Severity::Info => "info",
    Severity::Hint => "hint",
  }
}

pub(crate) fn severity_color(severity: &Severity) -> &'static str {
  match severity {
    Severity::Error => "91",
    Severity::Warning => "93",
    Severity::Info => "36",
    Severity::Hint => "90",
  }
}

pub(crate) fn hyperlink(text: &str, url: &str) -> String {
  if std::env::var("NO_COLOR").is_ok() {
    return text.to_string();
  }

  format!("\x1b]8;;{url}\x1b\\{text}\x1b]8;;\x1b\\")
}

pub(crate) struct Paint {
  enabled: bool,
}

impl Paint {
  pub(crate) fn new() -> Self {
    Self {
      enabled: std::env::var("NO_COLOR").is_err(),
    }
  }

  pub(crate) fn code(&self, code: &str, text: &str) -> String {
    if self.enabled {
      format!("\x1b[{code}m{text}\x1b[0m")
    } else {
      text.to_string()
    }
  }

  pub(crate) fn bold(&self, text: &str) -> String {
    self.code("1", text)
  }

  pub(crate) fn gray(&self, text: &str) -> String {
    self.code("90", text)
  }

  pub(crate) fn cyan(&self, text: &str) -> String {
    self.code("36", text)
  }

  pub(crate) fn green(&self, text: &str) -> String {
    self.code("32", text)
  }

  pub(crate) fn white(&self, text: &str) -> String {
    self.code("37", text)
  }

  pub(crate) fn severity(&self, severity: &Severity, text: &str) -> String {
    self.bold(&self.code(severity_color(severity), text))
  }
}

pub(crate) fn severity_part(paint: &Paint, severity: &Severity, count: usize) -> String {
  let label = if matches!(severity, Severity::Info) {
    format!("{count} info")
  } else {
    format!("{} {}", count, pluralize(count, severity_label(severity)))
  };

  paint.severity(severity, &label)
}

pub(crate) fn display_summary(result: &ProcessingResult, arguments: &CliArguments, context: &SummaryContext, duration: std::time::Duration) {
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
    println!(" {} {}", paint.bold(&paint.green("\u{2713}")), paint.bold(&paint.green("All files are clean!")));
  }

  display_version_skipped_rules(result, context);
}

pub(crate) fn files_with_severities(result: &ProcessingResult, severities: &[&Severity]) -> usize {
  let mut files: std::collections::HashSet<&str> = std::collections::HashSet::new();

  for processed in &result.all_offenses {
    if severities.iter().any(|severity| **severity == processed.offense.severity) {
      files.insert(processed.filename.as_str());
    }
  }

  files.len()
}

pub(crate) fn display_version_skipped_rules(result: &ProcessingResult, context: &SummaryContext) {
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

pub(crate) fn display_most_violated_rules(result: &ProcessingResult) {
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

pub(crate) fn pluralize(count: usize, singular: &str) -> String {
  if count == 1 {
    singular.to_string()
  } else {
    format!("{}s", singular)
  }
}
