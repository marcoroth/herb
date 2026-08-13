use serde::Deserialize;
use std::fmt::Write as _;

use std::collections::HashMap;

use crate::ansi::{ansi_sequence_at_start, visible_width};
use crate::color::{colorize, hyperlink, is_color_enabled, is_terminal, severity_color, NamedColor};
use crate::diagnostic::Diagnostic;
use crate::diagnostic_markers::{compute_diagnostic_markers, DiagnosticMarker};
use crate::gutter;
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::text_formatter::replace_backticks;
use crate::util::dim_styled_text;

#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct DiagnosticRenderOptions {
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub optimize_highlighting: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub code_url: Option<String>,
  pub file_url: Option<String>,
  pub suffix: Option<String>,
}

impl Default for DiagnosticRenderOptions {
  fn default() -> Self {
    Self {
      context_lines: 2,
      show_line_numbers: true,
      optimize_highlighting: true,
      wrap_lines: true,
      max_width: None,
      truncate_lines: false,
      code_url: None,
      file_url: None,
      suffix: None,
    }
  }
}

struct TruncatedLine {
  line: String,
  adjusted_start: f64,
  adjusted_end: f64,
}

pub struct DiagnosticRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> DiagnosticRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  fn highlight_backticks(&self, text: &str) -> String {
    if is_terminal() && is_color_enabled() {
      return replace_backticks(text, "\x1b[1m\x1b[37m", "\x1b[0m");
    }

    text.to_string()
  }

  fn truncate_line_for_diagnostic(&self, line: &str, diagnostic_start: usize, diagnostic_end: usize, max_width: usize) -> TruncatedLine {
    let plain_line_length = visible_width(line);

    if plain_line_length <= max_width {
      return TruncatedLine {
        line: line.to_string(),
        adjusted_start: diagnostic_start as f64,
        adjusted_end: diagnostic_end as f64,
      };
    }

    let ellipsis_character = "…";
    let ellipsis = colorize(ellipsis_character, NamedColor::Dim);
    let right_padding = 2;
    let ellipsis_character_length = ellipsis_character.chars().count();
    let ellipsis_length = ellipsis_character_length + right_padding;

    if (diagnostic_start as f64) < max_width as f64 / 3.0 {
      let available_width = max_width - ellipsis_length;
      let truncated = LineWrapper::truncate_line(line, available_width);

      return TruncatedLine {
        line: truncated,
        adjusted_start: diagnostic_start as f64,
        adjusted_end: diagnostic_end.min(available_width) as f64,
      };
    }

    if diagnostic_start as f64 > plain_line_length as f64 - max_width as f64 / 3.0 {
      let available_width = max_width - ellipsis_length;
      let start_position = plain_line_length.saturating_sub(available_width);

      let visible_portion = self.extract_portion_from_position(line, start_position as f64, plain_line_length as f64);
      let truncated = format!("{ellipsis}{visible_portion}");

      let offset = start_position as f64 - ellipsis_character_length as f64;

      return TruncatedLine {
        line: truncated,
        adjusted_start: (diagnostic_start as f64 - offset).max(0.0),
        adjusted_end: (diagnostic_end as f64 - offset).max(0.0),
      };
    }

    let context_width = (max_width - ellipsis_length * 2) as f64;
    let context_start = (diagnostic_start as f64 - context_width / 3.0).max(0.0);
    let context_end = (plain_line_length as f64).min(context_start + context_width);

    let visible_portion = self.extract_portion_from_position(line, context_start, context_end);
    let truncated = format!("{ellipsis}{visible_portion}{ellipsis}");

    TruncatedLine {
      line: truncated,
      adjusted_start: diagnostic_start as f64 - context_start + ellipsis_character_length as f64,
      adjusted_end: diagnostic_end as f64 - context_start + ellipsis_character_length as f64,
    }
  }

  fn extract_portion_from_position(&self, styled_line: &str, start_position: f64, end_position: f64) -> String {
    let mut styled_index = 0;
    let mut plain_index = 0.0;
    let mut result = String::new();
    let mut in_range = false;

    while styled_index < styled_line.len() && plain_index <= end_position {
      if let Some(sequence) = ansi_sequence_at_start(&styled_line[styled_index..]) {
        if in_range || plain_index >= start_position {
          result.push_str(sequence);
        }

        styled_index += sequence.len();

        continue;
      }

      let character = styled_line[styled_index..].chars().next().unwrap_or('\0');

      if plain_index >= start_position && !in_range {
        in_range = true;
      }

      if in_range {
        result.push(character);
      }

      styled_index += character.len_utf8();
      plain_index += 1.0;
    }

    result
  }

  pub fn render_single(&self, path: &str, diagnostic: &Diagnostic, content: &str, options: &DiagnosticRenderOptions) -> String {
    let context_lines = options.context_lines;
    let show_line_numbers = options.show_line_numbers;
    let optimize_highlighting = options.optimize_highlighting;
    let max_width = options.max_width.unwrap_or_else(LineWrapper::get_terminal_width);
    let truncate_lines = options.truncate_lines;

    let should_wrap = options.wrap_lines && !truncate_lines;
    let should_truncate = truncate_lines;

    let file_header_text = format!(
      "{}:{}",
      colorize(path, NamedColor::Cyan),
      colorize(
        &format!("{}:{}", diagnostic.location.start.line, diagnostic.location.start.column),
        NamedColor::Cyan
      )
    );

    let file_header = match &options.file_url {
      Some(file_url) => hyperlink(&file_header_text, file_url),
      None => file_header_text,
    };

    let color = severity_color(diagnostic.severity);
    let text = colorize(&colorize(diagnostic.severity.as_str(), color), NamedColor::Bold);
    let diagnostic_id_text = diagnostic.code.clone().unwrap_or_else(|| "-".to_string());

    let diagnostic_id = match &options.code_url {
      Some(code_url) => hyperlink(&diagnostic_id_text, code_url),
      None => diagnostic_id_text,
    };

    let original_lines: Vec<&str> = content.split('\n').collect();

    let markers = compute_diagnostic_markers(&diagnostic.location, &original_lines);
    let markers_by_line: HashMap<usize, DiagnosticMarker> = markers.iter().map(|marker| (marker.line, *marker)).collect();

    let first_marked_line = markers[0].line;
    let last_marked_line = markers[markers.len() - 1].line;

    let start_line = 1.max(first_marked_line.saturating_sub(context_lines));
    let end_line = original_lines.len().min(last_marked_line + context_lines);

    let highlighted_content;
    let lines: Vec<&str>;
    let line_offset;

    if optimize_highlighting {
      let mut relevant_lines: Vec<&str> = Vec::new();

      for number in start_line..=end_line {
        relevant_lines.push(original_lines.get(number - 1).copied().unwrap_or(""));
      }

      let relevant_content = relevant_lines.join("\n");

      highlighted_content = self.syntax_renderer.highlight(&relevant_content);
      lines = highlighted_content.split('\n').collect();
      line_offset = start_line - 1;
    } else {
      highlighted_content = self.syntax_renderer.highlight(content);
      lines = highlighted_content.split('\n').collect();
      line_offset = 0;
    }

    let gutter_prefix = if show_line_numbers { gutter::continuation_prefix() } else { String::new() };
    let available_width = if show_line_numbers { gutter::available_width(max_width) } else { max_width };

    let mut context_output = String::new();

    for number in start_line..=end_line {
      let line = lines.get(number - 1 - line_offset).copied().unwrap_or("");
      let marker = markers_by_line.get(&number);
      let is_target_line = marker.is_some();

      let mut marker_start = marker.map_or(0.0, |marker| marker.start as f64);
      let mut marker_length = marker.map_or(0.0, |marker| (marker.end as f64 - marker.start as f64).max(1.0));

      let line_prefix = if show_line_numbers {
        gutter::line_prefix(number, is_target_line, is_target_line.then_some(color))
      } else {
        String::new()
      };

      let display_line = if is_target_line { line.to_string() } else { dim_styled_text(line) };

      if should_wrap {
        let wrapped_lines = LineWrapper::wrap_line(&display_line, available_width, "");

        for (index, wrapped_line) in wrapped_lines.iter().enumerate() {
          if index == 0 {
            let _ = writeln!(context_output, "{line_prefix}{wrapped_line}");
          } else {
            let _ = writeln!(context_output, "{gutter_prefix}{wrapped_line}");
          }
        }
      } else if should_truncate {
        let truncated_line = match marker {
          Some(marker) => {
            let result = self.truncate_line_for_diagnostic(&display_line, marker.start, marker.end, available_width);

            marker_start = result.adjusted_start;
            marker_length = (result.adjusted_end - result.adjusted_start).max(1.0);

            result.line
          }

          None => LineWrapper::truncate_line(&display_line, available_width),
        };

        let _ = writeln!(context_output, "{line_prefix}{truncated_line}");
      } else {
        let _ = writeln!(context_output, "{line_prefix}{display_line}");
      }

      if marker.is_some() {
        let pointer_prefix = if show_line_numbers { gutter::pointer_prefix() } else { String::new() };
        let spacing = (marker_start + if show_line_numbers { 1.0 } else { 0.0 }).max(0.0) as usize;
        let pointer_spacing = " ".repeat(spacing);
        let pointer = colorize(&"~".repeat(marker_length as usize), color);

        let _ = writeln!(context_output, "{pointer_prefix}{pointer_spacing}{pointer}");
      }
    }

    let highlighted_message = self.highlight_backticks(&diagnostic.message);
    let suffix_text = match &options.suffix {
      Some(suffix) => format!(" {suffix}"),
      None => String::new(),
    };
    let header = if show_line_numbers { format!("{file_header}\n\n") } else { String::new() };

    format!(
      "[{text}] {highlighted_message} ({diagnostic_id}){suffix_text}\n\n{header}{}\n",
      context_output.trim_end()
    )
  }
}
