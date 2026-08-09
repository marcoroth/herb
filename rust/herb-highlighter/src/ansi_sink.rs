use std::collections::HashMap;
use std::fmt::Write as _;

use crate::ansi::{ansi_sequence_at_start, visible_width};
use crate::color::{colorize, hyperlink, is_color_enabled, is_terminal, severity_color, NamedColor};
use crate::diagnostic::DiagnosticSeverity;
use crate::diff_computer::DiffLineType;
use crate::diff_renderer::{DiffLayout, RemovedLineStyle, SingleLineStyle};
use crate::document::{Annotation, AnnotationMessage, CodeBlockKind, DiffHunkInfo, DiffRowInfo, Document, LineEmphasis, LineInfo, Node, StyledRun};
use crate::gutter;
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::text_formatter::{replace_backticks, TextFormatter};
use crate::util::{apply_background, dim_styled_text, slice_styled, BackgroundOptions, BackgroundRange};

const COLUMN_DIVIDER_WIDTH: usize = 3;
const AUTO_MAX_SPAN: usize = 24;
const AUTO_MAX_CHANGE_RATIO: f64 = 0.4;

const ADDED_COLOR: NamedColor = NamedColor::Green;
const REMOVED_COLOR: NamedColor = NamedColor::Red;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Numbering {
  Old,
  New,
}

pub struct AnsiSinkOptions {
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub truncate_lines: bool,
  pub max_width: usize,
  pub removed_line_style: RemovedLineStyle,
  pub single_line_style: SingleLineStyle,
  pub layout: DiffLayout,
  pub indent: String,
}

impl Default for AnsiSinkOptions {
  fn default() -> Self {
    Self {
      show_line_numbers: true,
      wrap_lines: true,
      truncate_lines: false,
      max_width: LineWrapper::get_terminal_width(),
      removed_line_style: RemovedLineStyle::Tint,
      single_line_style: SingleLineStyle::Split,
      layout: DiffLayout::Unified,
      indent: String::new(),
    }
  }
}

struct CardData<'a> {
  severity: DiagnosticSeverity,
  message: &'a str,
  code: Option<&'a str>,
  code_url: Option<&'a str>,
  suffix: Option<&'a str>,
  path: &'a str,
  line: usize,
  column: usize,
  file_url: Option<&'a str>,
}

struct BlockData<'a> {
  first_line: usize,
  runs: &'a [StyledRun],
  lines: &'a [LineInfo],
}

struct SplitContext<'a> {
  original_lines: &'a [&'a str],
  modified_lines: &'a [&'a str],
  removed_line_style: RemovedLineStyle,
  content_width: usize,
  separator: &'a str,
}

struct TruncatedLine {
  line: String,
  adjusted_start: f64,
  adjusted_end: f64,
}

pub struct AnsiSink<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> AnsiSink<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  pub fn render(&self, document: &Document, options: &AnsiSinkOptions) -> String {
    let mut results: Vec<String> = Vec::new();
    let mut index = 0;

    while index < document.nodes.len() {
      match &document.nodes[index] {
        Node::DiagnosticHeader {
          severity,
          message,
          code,
          code_url,
          suffix,
        } => {
          if let (Some(Node::FileHeader { path, line, column, url }), Some(Node::CodeBlock { first_line, runs, lines, .. })) =
            (document.nodes.get(index + 1), document.nodes.get(index + 2))
          {
            results.push(self.render_card(
              &CardData {
                severity: *severity,
                message,
                code: code.as_deref(),
                code_url: code_url.as_deref(),
                suffix: suffix.as_deref(),
                path,
                line: line.unwrap_or(0),
                column: column.unwrap_or(0),
                file_url: url.as_deref(),
              },
              &BlockData {
                first_line: *first_line,
                runs,
                lines,
              },
              options,
            ));

            index += 3;
          } else {
            index += 1;
          }
        }

        Node::FileHeader { path, .. } => match document.nodes.get(index + 1) {
          Some(Node::CodeBlock {
            kind: CodeBlockKind::AnnotatedListing,
            first_line,
            runs,
            lines,
          }) => {
            results.push(self.render_inline(
              path,
              &BlockData {
                first_line: *first_line,
                runs,
                lines,
              },
              options,
            ));

            index += 2;
          }

          Some(Node::CodeBlock { first_line, runs, lines, .. }) => {
            results.push(self.render_listing(
              Some(path),
              &BlockData {
                first_line: *first_line,
                runs,
                lines,
              },
              options,
            ));

            index += 2;
          }

          Some(Node::DiffBlock {
            original_runs,
            modified_runs,
            hunks,
          }) => {
            results.push(self.render_diff(Some(path), original_runs, modified_runs, hunks, options));

            index += 2;
          }

          _ => index += 1,
        },

        Node::CodeBlock { first_line, runs, lines, .. } => {
          results.push(self.render_listing(
            None,
            &BlockData {
              first_line: *first_line,
              runs,
              lines,
            },
            options,
          ));

          index += 1;
        }

        Node::DiffBlock {
          original_runs,
          modified_runs,
          hunks,
        } => {
          results.push(self.render_diff(None, original_runs, modified_runs, hunks, options));

          index += 1;
        }

        Node::ProgressRule { index: rule_index, total } => {
          results.push(self.render_rule(*rule_index, *total));

          index += 1;
        }
      }
    }

    results.join("\n\n")
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

  fn render_card(&self, card: &CardData<'_>, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let show_line_numbers = options.show_line_numbers;
    let max_width = options.max_width;
    let truncate_lines = options.truncate_lines;

    let should_wrap = options.wrap_lines && !truncate_lines;
    let should_truncate = truncate_lines;

    let file_header_text = format!(
      "{}:{}",
      colorize(card.path, NamedColor::Cyan),
      colorize(&format!("{}:{}", card.line, card.column), NamedColor::Cyan)
    );

    let file_header = match card.file_url {
      Some(file_url) => hyperlink(&file_header_text, file_url),
      None => file_header_text,
    };

    let color = severity_color(card.severity);
    let text = colorize(&colorize(card.severity.as_str(), color), NamedColor::Bold);
    let diagnostic_id_text = card.code.map(str::to_string).unwrap_or_else(|| "-".to_string());

    let diagnostic_id = match card.code_url {
      Some(code_url) => hyperlink(&diagnostic_id_text, code_url),
      None => diagnostic_id_text,
    };

    let highlighted_content = self.syntax_renderer.resolve_runs(block.runs);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let gutter_prefix = if show_line_numbers { gutter::continuation_prefix() } else { String::new() };
    let available_width = if show_line_numbers { gutter::available_width(max_width) } else { max_width };

    let mut context_output = String::new();

    for info in block.lines {
      let line = lines.get(info.number - block.first_line).copied().unwrap_or("");
      let marker = info.annotations.first();
      let is_target_line = marker.is_some();

      let mut marker_start = marker.map_or(0.0, |marker| marker.start as f64);
      let mut marker_length = marker.map_or(0.0, |marker| (marker.end as f64 - marker.start as f64).max(1.0));

      let line_prefix = if show_line_numbers {
        gutter::line_prefix(info.number, is_target_line, is_target_line.then_some(color))
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

    let highlighted_message = self.highlight_backticks(card.message);
    let suffix_text = match card.suffix {
      Some(suffix) => format!(" {suffix}"),
      None => String::new(),
    };
    let header = if show_line_numbers { format!("{file_header}\n\n") } else { String::new() };

    format!(
      "[{text}] {highlighted_message} ({diagnostic_id}){suffix_text}\n\n{header}{}\n",
      context_output.trim_end()
    )
  }

  fn message_row(&self, annotation: &Annotation, message: &AnnotationMessage) -> String {
    let severity_text = colorize(&colorize(annotation.severity.as_str(), severity_color(annotation.severity)), NamedColor::Bold);
    let diagnostic_id_text = message.code.clone().unwrap_or_else(|| "-".to_string());

    let diagnostic_id = match &message.code_url {
      Some(code_url) => hyperlink(&diagnostic_id_text, code_url),
      None => diagnostic_id_text,
    };

    let highlighted_message = TextFormatter::highlight_backticks(&message.text);
    let diagnostic_text = format!("[{severity_text}] {highlighted_message} ({diagnostic_id})");

    TextFormatter::dim_ansi_codes(&diagnostic_text)
  }

  fn render_inline(&self, path: &str, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let highlighted_content = self.syntax_renderer.resolve_runs(block.runs);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let mut output = if options.show_line_numbers {
      format!("{}\n\n", colorize(path, NamedColor::Cyan))
    } else {
      String::new()
    };
    let mut previous_line_had_messages = false;

    for info in block.lines {
      let line = lines.get(info.number - block.first_line).copied().unwrap_or("");
      let line_markers = &info.annotations;
      let has_diagnostics = !line_markers.is_empty();
      let has_messages = line_markers.iter().any(|annotation| annotation.message.is_some());

      if previous_line_had_messages {
        if options.show_line_numbers {
          let _ = writeln!(output, "{}", gutter::pointer_prefix());
        } else {
          output.push('\n');
        }
      }

      let highest_severity = match info.emphasis {
        LineEmphasis::Marked { severity } => severity,
        _ => DiagnosticSeverity::Warning,
      };
      let line_color = severity_color(highest_severity);

      let display_line = line;

      if options.wrap_lines && options.show_line_numbers {
        let line_prefix = gutter::line_prefix(info.number, has_diagnostics, has_diagnostics.then_some(line_color));
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
        let line_prefix = gutter::line_prefix(info.number, has_diagnostics, has_diagnostics.then_some(line_color));
        let available_width = gutter::available_width(options.max_width);

        let truncated_line = LineWrapper::truncate_line(display_line, available_width);

        let _ = writeln!(output, "{line_prefix}{truncated_line}");
      } else if options.show_line_numbers {
        let line_prefix = gutter::line_prefix(info.number, has_diagnostics, has_diagnostics.then_some(line_color));

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
        for annotation in line_markers {
          let pointer_length = (annotation.end - annotation.start).max(1);
          let pointer = colorize(&"~".repeat(pointer_length), severity_color(annotation.severity));

          if options.show_line_numbers {
            let pointer_prefix = gutter::pointer_prefix();
            let pointer_spacing = " ".repeat(annotation.start + 1);

            let _ = writeln!(output, "{pointer_prefix}{pointer_spacing}{pointer}");

            if let Some(message) = &annotation.message {
              let _ = writeln!(output, "{pointer_prefix}{pointer_spacing}{}", self.message_row(annotation, message));
            }
          } else {
            let pointer_spacing = " ".repeat(annotation.start);

            let _ = writeln!(output, "{pointer_spacing}{pointer}");

            if let Some(message) = &annotation.message {
              let _ = writeln!(output, "{}", self.message_row(annotation, message));
            }
          }
        }
      }

      previous_line_had_messages = has_messages;
    }

    output.trim_end().to_string()
  }

  fn render_listing(&self, path: Option<&str>, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let has_focus_layout = block
      .lines
      .iter()
      .any(|info| matches!(info.emphasis, LineEmphasis::Focus | LineEmphasis::Dimmed));

    if has_focus_layout {
      return self.render_focus(path, block, options);
    }

    match path {
      Some(path) if options.show_line_numbers => self.render_file(path, block, options),
      _ => self.render_plain(block, options),
    }
  }

  fn render_file(&self, path: &str, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let highlighted_content = self.syntax_renderer.resolve_runs(block.runs);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let mut output = format!("{}\n\n", colorize(path, NamedColor::Cyan));

    for info in block.lines {
      let line = lines.get(info.number - block.first_line).copied().unwrap_or("");

      if options.wrap_lines {
        let line_prefix = gutter::line_prefix(info.number, false, None);
        let available_width = gutter::available_width(options.max_width);
        let wrapped_lines = LineWrapper::wrap_line(line, available_width, "");

        for (index, wrapped_line) in wrapped_lines.iter().enumerate() {
          if index == 0 {
            let _ = writeln!(output, "{line_prefix}{wrapped_line}");
          } else {
            let _ = writeln!(output, "{}{wrapped_line}", gutter::continuation_prefix());
          }
        }
      } else if options.truncate_lines {
        let line_prefix = gutter::line_prefix(info.number, false, None);
        let available_width = gutter::available_width(options.max_width);
        let truncated_line = LineWrapper::truncate_line(line, available_width);

        let _ = writeln!(output, "{line_prefix}{truncated_line}");
      } else {
        let _ = writeln!(output, "{}{line}", gutter::line_prefix(info.number, false, None));
      }
    }

    output.trim_end().to_string()
  }

  fn render_focus(&self, path: Option<&str>, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let highlighted_content = self.syntax_renderer.resolve_runs(block.runs);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let mut output = match path {
      Some(path) if options.show_line_numbers => format!("{}\n\n", colorize(path, NamedColor::Cyan)),
      _ => String::new(),
    };

    for info in block.lines {
      let line = lines.get(info.number - block.first_line).copied().unwrap_or("");
      let is_focus_line = matches!(info.emphasis, LineEmphasis::Focus);

      if options.show_line_numbers {
        let line_prefix = gutter::line_prefix(info.number, is_focus_line, is_focus_line.then_some(NamedColor::Cyan.into()));
        let display_line = if is_focus_line { line.to_string() } else { dim_styled_text(line) };

        if options.wrap_lines {
          let available_width = gutter::available_width(options.max_width);
          let wrapped_lines = LineWrapper::wrap_line(&display_line, available_width, "");

          for (index, wrapped_line) in wrapped_lines.iter().enumerate() {
            if index == 0 {
              let _ = writeln!(output, "{line_prefix}{wrapped_line}");
            } else {
              let _ = writeln!(output, "{}{wrapped_line}", gutter::continuation_prefix());
            }
          }
        } else if options.truncate_lines {
          let available_width = gutter::available_width(options.max_width);
          let truncated_line = LineWrapper::truncate_line(&display_line, available_width);

          let _ = writeln!(output, "{line_prefix}{truncated_line}");
        } else {
          let _ = writeln!(output, "{line_prefix}{display_line}");
        }
      } else {
        let display_line = if is_focus_line { line.to_string() } else { dim_styled_text(line) };

        if options.wrap_lines {
          for wrapped_line in LineWrapper::wrap_line(&display_line, options.max_width, "") {
            let _ = writeln!(output, "{wrapped_line}");
          }
        } else if options.truncate_lines {
          let _ = writeln!(output, "{}", LineWrapper::truncate_line(&display_line, options.max_width));
        } else {
          let _ = writeln!(output, "{display_line}");
        }
      }
    }

    output.trim_end().to_string()
  }

  fn render_plain(&self, block: &BlockData<'_>, options: &AnsiSinkOptions) -> String {
    let highlighted = self.syntax_renderer.resolve_runs(block.runs);
    let lines: Vec<&str> = highlighted.split('\n').collect();

    if options.wrap_lines {
      let mut wrapped_lines: Vec<String> = Vec::new();

      for info in block.lines {
        let line = lines.get(info.number - block.first_line).copied().unwrap_or("");

        wrapped_lines.extend(LineWrapper::wrap_line(line, options.max_width, ""));
      }

      return wrapped_lines.join("\n");
    }

    if options.truncate_lines {
      let truncated_lines: Vec<String> = block
        .lines
        .iter()
        .map(|info| LineWrapper::truncate_line(lines.get(info.number - block.first_line).copied().unwrap_or(""), options.max_width))
        .collect();

      return truncated_lines.join("\n");
    }

    block
      .lines
      .iter()
      .map(|info| lines.get(info.number - block.first_line).copied().unwrap_or("").to_string())
      .collect::<Vec<_>>()
      .join("\n")
  }

  fn render_rule(&self, index: usize, total: usize) -> String {
    let width = LineWrapper::get_terminal_width();
    let progress_text = format!("[{index}/{total}]");
    let right_padding = 16;
    let separator_length = width.saturating_sub(progress_text.chars().count() + 1 + right_padding);
    let separator = "⎯";
    let left_separator = separator.repeat(separator_length);
    let right_separator = separator.repeat(4);

    format!("{left_separator}  {progress_text} {right_separator}")
  }

  fn render_diff(
    &self,
    path: Option<&str>,
    original_runs: &[StyledRun],
    modified_runs: &[StyledRun],
    hunks: &[DiffHunkInfo],
    options: &AnsiSinkOptions,
  ) -> String {
    let highlighted_original = self.syntax_renderer.resolve_runs(original_runs);
    let highlighted_modified = self.syntax_renderer.resolve_runs(modified_runs);

    let original_lines: Vec<&str> = highlighted_original.split('\n').collect();
    let modified_lines: Vec<&str> = highlighted_modified.split('\n').collect();

    let header = match path {
      Some(path) if options.show_line_numbers => format!("{}{}\n\n", options.indent, colorize(path, NamedColor::Cyan)),
      _ => String::new(),
    };

    format!("{header}{}", self.render_diff_hunks(hunks, &original_lines, &modified_lines, options))
  }

  fn render_diff_hunks(
    &self,
    hunks: &[DiffHunkInfo],
    highlighted_original_lines: &[&str],
    highlighted_modified_lines: &[&str],
    options: &AnsiSinkOptions,
  ) -> String {
    if options.layout == DiffLayout::Split {
      let column_width = (options.max_width.saturating_sub(options.indent.chars().count() + COLUMN_DIVIDER_WIDTH)) / 2;

      if column_width.saturating_sub(gutter::GUTTER_WIDTH) >= gutter::MIN_CONTENT_WIDTH {
        return self.render_split_layout(hunks, highlighted_original_lines, highlighted_modified_lines, column_width, options);
      }
    }

    let wrap_lines = options.wrap_lines && !options.truncate_lines;
    let separator = gutter::separator();
    let available_width = if options.show_line_numbers {
      gutter::MIN_CONTENT_WIDTH.max(options.max_width.saturating_sub(gutter::GUTTER_WIDTH + options.indent.chars().count()))
    } else {
      gutter::MIN_CONTENT_WIDTH.max(options.max_width.saturating_sub(options.indent.chars().count()))
    };

    let gutter_prefix = if options.show_line_numbers {
      format!("{}        {separator} ", options.indent)
    } else {
      options.indent.clone()
    };

    let mut output = String::new();

    for (hunk_index, hunk) in hunks.iter().enumerate() {
      if hunk_index > 0 {
        let _ = writeln!(output, "{gutter_prefix}{}", colorize("⋮", NamedColor::Gray));
      }

      let collapsed = match options.single_line_style {
        SingleLineStyle::Split => HashMap::new(),

        style => self.collapsible_rows(hunk, highlighted_original_lines, highlighted_modified_lines, style, available_width),
      };

      for (index, row) in hunk.rows.iter().enumerate() {
        if row.kind == DiffLineType::Added && collapsed.contains_key(&index) {
          continue;
        }

        let composite = collapsed.get(&index);

        let highlighted = self.highlighted_content_for(row, highlighted_original_lines, highlighted_modified_lines);

        let display_line = match composite {
          Some(composite) => composite.clone(),
          None => self.style_content(&highlighted, row, options.removed_line_style),
        };

        let line_prefix = if options.show_line_numbers {
          let gutter = if composite.is_some() {
            self.collapsed_gutter_for(row)
          } else {
            self.gutter_for(row, Numbering::Old)
          };

          format!("{}{gutter}{separator} ", options.indent)
        } else {
          let marker = if composite.is_some() {
            colorize("± ", NamedColor::Yellow)
          } else {
            self.marker_for(row)
          };

          format!("{}{marker}", options.indent)
        };

        if wrap_lines {
          let wrapped_lines = LineWrapper::wrap_line(&display_line, available_width, "");

          for (wrapped_index, wrapped_line) in wrapped_lines.iter().enumerate() {
            if wrapped_index == 0 {
              let _ = writeln!(output, "{line_prefix}{wrapped_line}");
            } else {
              let _ = writeln!(output, "{gutter_prefix}{wrapped_line}");
            }
          }
        } else if options.truncate_lines {
          let _ = writeln!(output, "{line_prefix}{}", LineWrapper::truncate_line(&display_line, available_width));
        } else {
          let _ = writeln!(output, "{line_prefix}{display_line}");
        }
      }
    }

    output.trim_end().to_string()
  }

  fn style_content(&self, highlighted: &str, row: &DiffRowInfo, removed_line_style: RemovedLineStyle) -> String {
    if row.kind == DiffLineType::Context {
      return dim_styled_text(highlighted);
    }

    if row.kind == DiffLineType::Removed && removed_line_style == RemovedLineStyle::Dim {
      return dim_styled_text(highlighted);
    }

    let colors = self.syntax_renderer.color_scheme();

    let line_color = if row.kind == DiffLineType::Added {
      colors.diff_added_line_background
    } else if removed_line_style == RemovedLineStyle::Tint {
      colors.diff_removed_line_background
    } else {
      None
    };

    let range_color = if row.kind == DiffLineType::Added {
      colors.diff_added_background
    } else {
      colors.diff_removed_background
    };

    let background_ranges: Vec<BackgroundRange> = row
      .inline_ranges
      .iter()
      .map(|range| BackgroundRange {
        start: range.start,
        end: range.end,
      })
      .collect();

    apply_background(
      highlighted,
      &BackgroundOptions {
        line_color,
        ranges: &background_ranges,
        range_color,
      },
    )
  }

  fn render_split_layout(
    &self,
    hunks: &[DiffHunkInfo],
    highlighted_original_lines: &[&str],
    highlighted_modified_lines: &[&str],
    column_width: usize,
    options: &AnsiSinkOptions,
  ) -> String {
    let separator = gutter::separator();
    let divider = format!(" {} ", colorize("┃", NamedColor::Gray));
    let content_width = column_width - gutter::GUTTER_WIDTH;

    let mut output = String::new();

    for (hunk_index, hunk) in hunks.iter().enumerate() {
      if hunk_index > 0 {
        let gutter = format!("        {separator} {}", colorize("⋮", NamedColor::Gray));

        let _ = writeln!(output, "{}{}{divider}{gutter}", options.indent, self.pad_styled(&gutter, column_width));
      }

      for (left, right) in hunk.split_row_pairs() {
        let context = SplitContext {
          original_lines: highlighted_original_lines,
          modified_lines: highlighted_modified_lines,
          removed_line_style: options.removed_line_style,
          content_width,
          separator: &separator,
        };

        let left_cell = self.split_cell(hunk, left, Numbering::Old, &context);
        let right_cell = self.split_cell(hunk, right, Numbering::New, &context);

        let _ = writeln!(output, "{}{}{divider}{right_cell}", options.indent, self.pad_styled(&left_cell, column_width));
      }
    }

    output.trim_end().to_string()
  }

  fn split_cell(&self, hunk: &DiffHunkInfo, index: Option<usize>, numbering: Numbering, context: &SplitContext<'_>) -> String {
    let SplitContext {
      original_lines,
      modified_lines,
      removed_line_style,
      content_width,
      separator,
    } = context;
    let Some(index) = index else {
      return format!("{}{separator} ", " ".repeat(8));
    };

    let row = &hunk.rows[index];

    let highlighted = self.highlighted_content_for(row, original_lines, modified_lines);
    let styled = self.style_content(&highlighted, row, *removed_line_style);

    format!(
      "{}{separator} {}",
      self.gutter_for(row, numbering),
      LineWrapper::truncate_line(&styled, *content_width)
    )
  }

  fn pad_styled(&self, text: &str, width: usize) -> String {
    let printable_length = visible_width(text);

    format!("{text}{}", " ".repeat(width.saturating_sub(printable_length)))
  }

  fn collapsible_rows(
    &self,
    hunk: &DiffHunkInfo,
    original_lines: &[&str],
    modified_lines: &[&str],
    style: SingleLineStyle,
    available_width: usize,
  ) -> HashMap<usize, String> {
    let mut collapsed: HashMap<usize, String> = HashMap::new();

    if !is_color_enabled() {
      return collapsed;
    }

    if hunk.rows.is_empty() {
      return collapsed;
    }

    let colors = self.syntax_renderer.color_scheme();

    let mut index = 0;

    while index < hunk.rows.len() - 1 {
      let removed = &hunk.rows[index];
      let added = &hunk.rows[index + 1];

      let Some(collapse) = &removed.collapse else {
        index += 1;

        continue;
      };

      let start = collapse.start;
      let removed_end = collapse.removed_end;
      let added_end = collapse.added_end;

      if style == SingleLineStyle::Auto && !self.worth_collapsing(removed, added, start, removed_end, added_end, available_width) {
        index += 1;

        continue;
      }

      let removed_text = original_lines
        .get(removed.old_line.expect("removed lines carry an old line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| removed.content.clone());

      let added_text = modified_lines
        .get(added.new_line.expect("added lines carry a new line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| added.content.clone());

      let prefix = slice_styled(&added_text, 0, start);
      let suffix = slice_styled(&added_text, added_end, added.content.chars().count());

      let removed_span = if removed_end > start {
        apply_background(
          &slice_styled(&removed_text, start, removed_end),
          &BackgroundOptions {
            line_color: colors.diff_removed_background,
            ranges: &[],
            range_color: None,
          },
        )
      } else {
        String::new()
      };

      let added_span = if added_end > start {
        apply_background(
          &slice_styled(&added_text, start, added_end),
          &BackgroundOptions {
            line_color: colors.diff_added_background,
            ranges: &[],
            range_color: None,
          },
        )
      } else {
        String::new()
      };

      let composite = format!("{prefix}{removed_span}{added_span}{suffix}");

      collapsed.insert(index, composite.clone());
      collapsed.insert(index + 1, composite);

      index += 2;
    }

    collapsed
  }

  fn worth_collapsing(&self, removed: &DiffRowInfo, added: &DiffRowInfo, start: usize, removed_end: usize, added_end: usize, available_width: usize) -> bool {
    let removed_span = removed_end.saturating_sub(start);
    let added_span = added_end.saturating_sub(start);

    let added_length = added.content.chars().count();
    let removed_length = removed.content.chars().count();

    let composite_length = added_length + removed_span;

    if composite_length > available_width {
      return false;
    }

    if removed_span == 0 || added_span == 0 {
      return true;
    }

    if removed_span.max(added_span) > AUTO_MAX_SPAN {
      return false;
    }

    let longest_line = removed_length.max(added_length);

    (removed_span + added_span) as f64 <= longest_line as f64 * AUTO_MAX_CHANGE_RATIO
  }

  fn collapsed_gutter_for(&self, row: &DiffRowInfo) -> String {
    let number = format_line_number(row.old_line);

    format!("{}{} ", colorize("  ± ", NamedColor::Yellow), colorize(&number, NamedColor::Bold))
  }

  fn highlighted_content_for(&self, row: &DiffRowInfo, original_lines: &[&str], modified_lines: &[&str]) -> String {
    if row.kind == DiffLineType::Added {
      return modified_lines
        .get(row.new_line.expect("added lines carry a new line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| row.content.clone());
    }

    original_lines
      .get(row.old_line.expect("context and removed lines carry an old line number") - 1)
      .map(|content| content.to_string())
      .unwrap_or_else(|| row.content.clone())
  }

  fn marker_for(&self, row: &DiffRowInfo) -> String {
    match row.kind {
      DiffLineType::Added => colorize("+ ", ADDED_COLOR),
      DiffLineType::Removed => colorize("- ", REMOVED_COLOR),
      DiffLineType::Context => "  ".to_string(),
    }
  }

  fn gutter_for(&self, row: &DiffRowInfo, numbering: Numbering) -> String {
    let line_number = if numbering == Numbering::New { row.new_line } else { row.old_line };
    let number = format_line_number(line_number);

    let emphasized = if line_number.is_none() {
      number.clone()
    } else {
      colorize(&number, NamedColor::Bold)
    };

    match row.kind {
      DiffLineType::Added => format!("{}{emphasized} ", colorize("  + ", ADDED_COLOR)),
      DiffLineType::Removed => format!("{}{emphasized} ", colorize("  - ", REMOVED_COLOR)),
      DiffLineType::Context => format!("    {} ", colorize(&number, NamedColor::Gray)),
    }
  }
}

fn format_line_number(line_number: Option<usize>) -> String {
  match line_number {
    Some(number) => format!("{number:>3}"),
    None => "   ".to_string(),
  }
}
