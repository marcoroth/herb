use std::fmt::Write as _;

use std::collections::HashMap;

use crate::color::{colorize, hyperlink, severity_color, NamedColor};
use crate::diagnostic::{Diagnostic, DiagnosticSeverity, DIAGNOSTIC_SEVERITIES};
use crate::diagnostic_markers::{compute_diagnostic_markers, DiagnosticMarker};
use crate::file_renderer::RenderOptions;
use crate::gutter;
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::text_formatter::TextFormatter;

struct LineMarker<'a> {
  diagnostic: &'a Diagnostic,
  marker: DiagnosticMarker,
  is_last_line: bool,
}

pub type CodeUrlBuilder<'a> = &'a dyn Fn(&str) -> String;

pub struct InlineDiagnosticRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> InlineDiagnosticRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  fn severity_text(&self, severity: DiagnosticSeverity) -> String {
    colorize(&colorize(severity.as_str(), severity_color(severity)), NamedColor::Bold)
  }

  fn highest_severity(&self, diagnostics: &[&Diagnostic]) -> DiagnosticSeverity {
    for severity in DIAGNOSTIC_SEVERITIES {
      if diagnostics.iter().any(|diagnostic| diagnostic.severity == severity) {
        return severity;
      }
    }

    DiagnosticSeverity::Warning
  }

  pub fn render(&self, path: &str, content: &str, diagnostics: &[Diagnostic], options: &RenderOptions, code_url_builder: Option<CodeUrlBuilder<'_>>) -> String {
    let highlighted_content = self.syntax_renderer.highlight(content);
    let content_lines: Vec<&str> = content.split('\n').collect();

    let mut markers_by_line: HashMap<usize, Vec<LineMarker<'_>>> = HashMap::new();

    for diagnostic in diagnostics {
      let markers = compute_diagnostic_markers(&diagnostic.location, &content_lines);
      let last_index = markers.len() - 1;

      for (index, marker) in markers.into_iter().enumerate() {
        markers_by_line.entry(marker.line).or_default().push(LineMarker {
          diagnostic,
          marker,
          is_last_line: index == last_index,
        });
      }
    }

    for line_markers in markers_by_line.values_mut() {
      line_markers.sort_by_key(|line_marker| line_marker.diagnostic.severity.order());
    }

    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let mut output = if options.show_line_numbers {
      format!("{}\n\n", colorize(path, NamedColor::Cyan))
    } else {
      String::new()
    };
    let mut previous_line_had_messages = false;

    for number in 1..=lines.len() {
      let line = lines.get(number - 1).copied().unwrap_or("");
      let empty: Vec<LineMarker<'_>> = Vec::new();
      let line_markers = markers_by_line.get(&number).unwrap_or(&empty);
      let line_diagnostics: Vec<&Diagnostic> = line_markers.iter().map(|line_marker| line_marker.diagnostic).collect();
      let has_diagnostics = !line_markers.is_empty();
      let has_messages = line_markers.iter().any(|line_marker| line_marker.is_last_line);

      if previous_line_had_messages {
        if options.show_line_numbers {
          let _ = writeln!(output, "{}", gutter::pointer_prefix());
        } else {
          output.push('\n');
        }
      }

      let highest_severity = self.highest_severity(&line_diagnostics);
      let line_color = severity_color(highest_severity);

      let display_line = line;

      if options.wrap_lines && options.show_line_numbers {
        let line_prefix = gutter::line_prefix(number, has_diagnostics, has_diagnostics.then_some(line_color));
        let available_width = gutter::available_width(options.max_width);

        let wrapped_lines = LineWrapper::wrap_line(display_line, available_width, "");

        for (index, wrapped_line) in wrapped_lines.iter().enumerate() {
          if index == 0 {
            let _ = writeln!(output, "{line_prefix}{wrapped_line}");
          } else {
            let _ = writeln!(output, "{}{wrapped_line}", gutter::continuation_prefix());
          }
        }
      } else if options.truncate_lines && options.show_line_numbers {
        let line_prefix = gutter::line_prefix(number, has_diagnostics, has_diagnostics.then_some(line_color));
        let available_width = gutter::available_width(options.max_width);

        let truncated_line = LineWrapper::truncate_line(display_line, available_width);

        let _ = writeln!(output, "{line_prefix}{truncated_line}");
      } else if options.show_line_numbers {
        let line_prefix = gutter::line_prefix(number, has_diagnostics, has_diagnostics.then_some(line_color));

        let _ = writeln!(output, "{line_prefix}{display_line}");
      } else if options.wrap_lines {
        for wrapped_line in LineWrapper::wrap_line(display_line, options.max_width, "") {
          let _ = writeln!(output, "{wrapped_line}");
        }
      } else if options.truncate_lines {
        let _ = writeln!(output, "{}", LineWrapper::truncate_line(display_line, options.max_width));
      } else {
        let _ = writeln!(output, "{display_line}");
      }

      if has_diagnostics {
        for LineMarker {
          diagnostic,
          marker,
          is_last_line,
        } in line_markers
        {
          let pointer_length = (marker.end - marker.start).max(1);
          let pointer = colorize(&"~".repeat(pointer_length), severity_color(diagnostic.severity));

          let severity_text = self.severity_text(diagnostic.severity);
          let diagnostic_id_text = diagnostic.code.clone().unwrap_or_else(|| "-".to_string());

          let diagnostic_id = match (code_url_builder, &diagnostic.code) {
            (Some(builder), Some(code)) => hyperlink(&diagnostic_id_text, &builder(code)),
            _ => diagnostic_id_text,
          };

          let highlighted_message = TextFormatter::highlight_backticks(&diagnostic.message);
          let diagnostic_text = format!("[{severity_text}] {highlighted_message} ({diagnostic_id})");
          let dimmed_diagnostic_text = TextFormatter::dim_ansi_codes(&diagnostic_text);

          if options.show_line_numbers {
            let pointer_prefix = gutter::pointer_prefix();
            let pointer_spacing = " ".repeat(marker.start + 1);

            let _ = writeln!(output, "{pointer_prefix}{pointer_spacing}{pointer}");

            if *is_last_line {
              let _ = writeln!(output, "{pointer_prefix}{pointer_spacing}{dimmed_diagnostic_text}");
            }
          } else {
            let pointer_spacing = " ".repeat(marker.start);

            let _ = writeln!(output, "{pointer_spacing}{pointer}");

            if *is_last_line {
              let _ = writeln!(output, "{dimmed_diagnostic_text}");
            }
          }
        }
      }

      previous_line_had_messages = has_messages;
    }

    output.trim_end().to_string()
  }
}
