use std::fmt::Write as _;

use crate::color::{colorize, NamedColor};
use crate::gutter;
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::util::dim_styled_text;

#[derive(Debug, Clone, Copy)]
pub struct RenderOptions {
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: usize,
  pub truncate_lines: bool,
}

pub struct FileRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> FileRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  pub fn render_with_line_numbers(&self, path: &str, content: &str, options: &RenderOptions) -> String {
    let highlighted_content = self.syntax_renderer.highlight(content);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let mut output = format!("{}\n\n", colorize(path, NamedColor::Cyan));

    for number in 1..=lines.len() {
      let line = lines.get(number - 1).copied().unwrap_or("");

      if options.wrap_lines {
        let line_prefix = gutter::line_prefix(number, false, None);
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
        let line_prefix = gutter::line_prefix(number, false, None);
        let available_width = gutter::available_width(options.max_width);
        let truncated_line = LineWrapper::truncate_line(line, available_width);

        let _ = writeln!(output, "{line_prefix}{truncated_line}");
      } else {
        let _ = writeln!(output, "{}{line}", gutter::line_prefix(number, false, None));
      }
    }

    output.trim_end().to_string()
  }

  pub fn render_with_focus_line(&self, path: &str, content: &str, focus_line: usize, context_lines: usize, options: &RenderOptions) -> String {
    let highlighted_content = self.syntax_renderer.highlight(content);
    let lines: Vec<&str> = highlighted_content.split('\n').collect();

    let start_line = 1.max(focus_line.saturating_sub(context_lines));
    let end_line = lines.len().min(focus_line + context_lines);

    let mut output = if options.show_line_numbers {
      format!("{}\n\n", colorize(path, NamedColor::Cyan))
    } else {
      String::new()
    };

    for number in start_line..=end_line {
      let line = lines.get(number - 1).copied().unwrap_or("");
      let is_focus_line = number == focus_line;

      if options.show_line_numbers {
        let line_prefix = gutter::line_prefix(number, is_focus_line, is_focus_line.then_some(NamedColor::Cyan.into()));
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

  pub fn render_plain(&self, content: &str, options: &RenderOptions) -> String {
    let highlighted = self.syntax_renderer.highlight(content);

    if options.wrap_lines {
      let mut wrapped_lines: Vec<String> = Vec::new();

      for line in highlighted.split('\n') {
        wrapped_lines.extend(LineWrapper::wrap_line(line, options.max_width, ""));
      }

      return wrapped_lines.join("\n");
    }

    if options.truncate_lines {
      let truncated_lines: Vec<String> = highlighted
        .split('\n')
        .map(|line| LineWrapper::truncate_line(line, options.max_width))
        .collect();

      return truncated_lines.join("\n");
    }

    highlighted
  }
}
