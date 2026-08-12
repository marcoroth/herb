use std::fmt::Write as _;

use std::collections::HashMap;

use crate::ansi::visible_width;
use crate::color::{colorize, is_color_enabled, NamedColor};
use crate::diff_computer::{compute_diff_hunks, compute_inline_ranges, DiffHunk, DiffLine, DiffLineType, InlineRange};
use crate::gutter::{separator, GUTTER_WIDTH, MIN_CONTENT_WIDTH};
use crate::line_wrapper::LineWrapper;
use crate::syntax_renderer::SyntaxRenderer;
use crate::themes::ColorScheme;
use crate::util::{apply_background, dim_styled_text, slice_styled, BackgroundOptions, BackgroundRange};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RemovedLineStyle {
  #[default]
  Tint,
  Dim,
  None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SingleLineStyle {
  #[default]
  Split,
  Inline,
  Auto,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DiffLayout {
  #[default]
  Unified,
  Split,
}

#[derive(Debug, Clone)]
pub struct DiffRenderOptions {
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub highlight_inline_changes: bool,
  pub removed_line_style: RemovedLineStyle,
  pub single_line_style: SingleLineStyle,
  pub layout: DiffLayout,
  pub indent: String,
}

impl Default for DiffRenderOptions {
  fn default() -> Self {
    Self {
      context_lines: 2,
      show_line_numbers: true,
      wrap_lines: true,
      max_width: None,
      truncate_lines: false,
      highlight_inline_changes: true,
      removed_line_style: RemovedLineStyle::Tint,
      single_line_style: SingleLineStyle::Split,
      layout: DiffLayout::Unified,
      indent: String::new(),
    }
  }
}

struct SplitContext<'a> {
  original_lines: &'a [&'a str],
  modified_lines: &'a [&'a str],
  inline_ranges: &'a HashMap<usize, Vec<InlineRange>>,
  removed_line_style: RemovedLineStyle,
  content_width: usize,
  separator: &'a str,
}

struct RenderHunksOptions {
  show_line_numbers: bool,
  wrap_lines: bool,
  truncate_lines: bool,
  max_width: usize,
  highlight_inline_changes: bool,
  removed_line_style: RemovedLineStyle,
  single_line_style: SingleLineStyle,
  layout: DiffLayout,
  indent: String,
}

impl From<(&DiffRenderOptions, usize)> for RenderHunksOptions {
  fn from((options, max_width): (&DiffRenderOptions, usize)) -> Self {
    Self {
      show_line_numbers: options.show_line_numbers,
      wrap_lines: options.wrap_lines && !options.truncate_lines,
      truncate_lines: options.truncate_lines,
      max_width,
      highlight_inline_changes: options.highlight_inline_changes,
      removed_line_style: options.removed_line_style,
      single_line_style: options.single_line_style,
      layout: options.layout,
      indent: options.indent.clone(),
    }
  }
}

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

pub struct DiffRenderer<'a> {
  syntax_renderer: &'a SyntaxRenderer,
  colors: ColorScheme,
}

impl<'a> DiffRenderer<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer, colors: ColorScheme) -> Self {
    Self { syntax_renderer, colors }
  }

  pub fn render(&self, path: &str, original: &str, modified: &str, options: &DiffRenderOptions) -> String {
    let max_width = options.max_width.unwrap_or_else(LineWrapper::get_terminal_width);

    let hunks = compute_diff_hunks(original, modified, options.context_lines);

    if hunks.is_empty() {
      return String::new();
    }

    let highlighted_original = self.syntax_renderer.highlight(original);
    let highlighted_modified = self.syntax_renderer.highlight(modified);

    let original_lines: Vec<&str> = highlighted_original.split('\n').collect();
    let modified_lines: Vec<&str> = highlighted_modified.split('\n').collect();

    let header = if options.show_line_numbers && !path.is_empty() {
      format!("{}{}\n\n", options.indent, colorize(path, NamedColor::Cyan))
    } else {
      String::new()
    };

    let render_options = RenderHunksOptions::from((options, max_width));

    format!("{header}{}", self.render_hunks(&hunks, &original_lines, &modified_lines, &render_options))
  }

  pub fn render_from_hunks(&self, path: &str, hunks: &[DiffHunk], options: &DiffRenderOptions) -> String {
    if hunks.is_empty() {
      return String::new();
    }

    let max_width = options.max_width.unwrap_or_else(LineWrapper::get_terminal_width);

    let mut original_source: Vec<String> = Vec::new();
    let mut modified_source: Vec<String> = Vec::new();

    for hunk in hunks {
      for line in &hunk.lines {
        if let Some(number) = line.old_line_number {
          fill(&mut original_source, number - 1, line.content.clone());
        }

        if let Some(number) = line.new_line_number {
          fill(&mut modified_source, number - 1, line.content.clone());
        }
      }
    }

    let highlighted_original = self.syntax_renderer.highlight(&original_source.join("\n"));
    let highlighted_modified = self.syntax_renderer.highlight(&modified_source.join("\n"));

    let original_lines: Vec<&str> = highlighted_original.split('\n').collect();
    let modified_lines: Vec<&str> = highlighted_modified.split('\n').collect();

    let header = if options.show_line_numbers && !path.is_empty() {
      format!("{}{}\n\n", options.indent, colorize(path, NamedColor::Cyan))
    } else {
      String::new()
    };

    let render_options = RenderHunksOptions::from((options, max_width));

    format!("{header}{}", self.render_hunks(hunks, &original_lines, &modified_lines, &render_options))
  }

  fn render_hunks(&self, hunks: &[DiffHunk], highlighted_original_lines: &[&str], highlighted_modified_lines: &[&str], options: &RenderHunksOptions) -> String {
    if options.layout == DiffLayout::Split {
      let column_width = (options.max_width.saturating_sub(options.indent.chars().count() + COLUMN_DIVIDER_WIDTH)) / 2;

      if column_width.saturating_sub(GUTTER_WIDTH) >= MIN_CONTENT_WIDTH {
        return self.render_split_layout(hunks, highlighted_original_lines, highlighted_modified_lines, column_width, options);
      }
    }

    let separator = separator();
    let available_width = if options.show_line_numbers {
      MIN_CONTENT_WIDTH.max(options.max_width.saturating_sub(GUTTER_WIDTH + options.indent.chars().count()))
    } else {
      MIN_CONTENT_WIDTH.max(options.max_width.saturating_sub(options.indent.chars().count()))
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

      let inline_ranges = if options.highlight_inline_changes {
        self.inline_ranges_for(hunk)
      } else {
        HashMap::new()
      };

      let collapsed = match options.single_line_style {
        SingleLineStyle::Split => HashMap::new(),

        style => self.collapsible_lines(
          hunk,
          &inline_ranges,
          highlighted_original_lines,
          highlighted_modified_lines,
          style,
          available_width,
        ),
      };

      for (index, line) in hunk.lines.iter().enumerate() {
        if line.line_type == DiffLineType::Added && collapsed.contains_key(&index) {
          continue;
        }

        let composite = collapsed.get(&index);

        let highlighted = self.highlighted_content_for(line, highlighted_original_lines, highlighted_modified_lines);

        let display_line = match composite {
          Some(composite) => composite.clone(),
          None => self.style_content(&highlighted, line, inline_ranges.get(&index), options.removed_line_style),
        };

        let line_prefix = if options.show_line_numbers {
          let gutter = if composite.is_some() {
            self.collapsed_gutter_for(line)
          } else {
            self.gutter_for(line, Numbering::Old)
          };

          format!("{}{gutter}{separator} ", options.indent)
        } else {
          let marker = if composite.is_some() {
            colorize("± ", NamedColor::Yellow)
          } else {
            self.marker_for(line)
          };

          format!("{}{marker}", options.indent)
        };

        if options.wrap_lines {
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

  fn inline_ranges_for(&self, hunk: &DiffHunk) -> HashMap<usize, Vec<InlineRange>> {
    let mut ranges: HashMap<usize, Vec<InlineRange>> = HashMap::new();

    let mut index = 0;

    while index < hunk.lines.len() {
      if hunk.lines[index].line_type != DiffLineType::Removed {
        index += 1;

        continue;
      }

      let mut removed: Vec<usize> = Vec::new();

      while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Removed {
        removed.push(index);
        index += 1;
      }

      let mut added: Vec<usize> = Vec::new();

      while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Added {
        added.push(index);
        index += 1;
      }

      if removed.len() != added.len() {
        continue;
      }

      for pair in 0..removed.len() {
        let inline = compute_inline_ranges(&hunk.lines[removed[pair]].content, &hunk.lines[added[pair]].content);

        if !inline.removed.is_empty() || !inline.added.is_empty() {
          ranges.insert(removed[pair], inline.removed);
          ranges.insert(added[pair], inline.added);
        }
      }
    }

    ranges
  }

  fn style_content(&self, highlighted: &str, line: &DiffLine, ranges: Option<&Vec<InlineRange>>, removed_line_style: RemovedLineStyle) -> String {
    if line.line_type == DiffLineType::Context {
      return dim_styled_text(highlighted);
    }

    if line.line_type == DiffLineType::Removed && removed_line_style == RemovedLineStyle::Dim {
      return dim_styled_text(highlighted);
    }

    let line_color = if line.line_type == DiffLineType::Added {
      self.colors.diff_added_line_background
    } else if removed_line_style == RemovedLineStyle::Tint {
      self.colors.diff_removed_line_background
    } else {
      None
    };

    let range_color = if line.line_type == DiffLineType::Added {
      self.colors.diff_added_background
    } else {
      self.colors.diff_removed_background
    };

    let background_ranges: Vec<BackgroundRange> = ranges
      .map(|ranges| {
        ranges
          .iter()
          .map(|range| BackgroundRange {
            start: range.start,
            end: range.end,
          })
          .collect()
      })
      .unwrap_or_default();

    apply_background(
      highlighted,
      &BackgroundOptions {
        line_color,
        ranges: &background_ranges,
        range_color,
      },
    )
  }

  fn rows_for(&self, hunk: &DiffHunk) -> Vec<(Option<usize>, Option<usize>)> {
    let mut rows: Vec<(Option<usize>, Option<usize>)> = Vec::new();

    let mut index = 0;

    while index < hunk.lines.len() {
      if hunk.lines[index].line_type == DiffLineType::Context {
        rows.push((Some(index), Some(index)));
        index += 1;

        continue;
      }

      let mut removed: Vec<usize> = Vec::new();

      while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Removed {
        removed.push(index);
        index += 1;
      }

      let mut added: Vec<usize> = Vec::new();

      while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Added {
        added.push(index);
        index += 1;
      }

      for row in 0..removed.len().max(added.len()) {
        rows.push((removed.get(row).copied(), added.get(row).copied()));
      }
    }

    rows
  }

  fn render_split_layout(
    &self,
    hunks: &[DiffHunk],
    highlighted_original_lines: &[&str],
    highlighted_modified_lines: &[&str],
    column_width: usize,
    options: &RenderHunksOptions,
  ) -> String {
    let separator = separator();
    let divider = format!(" {} ", colorize("┃", NamedColor::Gray));
    let content_width = column_width - GUTTER_WIDTH;

    let mut output = String::new();

    for (hunk_index, hunk) in hunks.iter().enumerate() {
      let inline_ranges = if options.highlight_inline_changes {
        self.inline_ranges_for(hunk)
      } else {
        HashMap::new()
      };

      if hunk_index > 0 {
        let gutter = format!("        {separator} {}", colorize("⋮", NamedColor::Gray));

        let _ = writeln!(output, "{}{}{divider}{gutter}", options.indent, self.pad_styled(&gutter, column_width));
      }

      for (left, right) in self.rows_for(hunk) {
        let context = SplitContext {
          original_lines: highlighted_original_lines,
          modified_lines: highlighted_modified_lines,
          inline_ranges: &inline_ranges,
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

  fn split_cell(&self, hunk: &DiffHunk, index: Option<usize>, numbering: Numbering, context: &SplitContext<'_>) -> String {
    let SplitContext {
      original_lines,
      modified_lines,
      inline_ranges,
      removed_line_style,
      content_width,
      separator,
    } = context;
    let Some(index) = index else {
      return format!("{}{separator} ", " ".repeat(8));
    };

    let line = &hunk.lines[index];

    let highlighted = self.highlighted_content_for(line, original_lines, modified_lines);
    let styled = self.style_content(&highlighted, line, inline_ranges.get(&index), *removed_line_style);

    format!(
      "{}{separator} {}",
      self.gutter_for(line, numbering),
      LineWrapper::truncate_line(&styled, *content_width)
    )
  }

  fn pad_styled(&self, text: &str, width: usize) -> String {
    let printable_length = visible_width(text);

    format!("{text}{}", " ".repeat(width.saturating_sub(printable_length)))
  }

  fn collapsible_lines(
    &self,
    hunk: &DiffHunk,
    inline_ranges: &HashMap<usize, Vec<InlineRange>>,
    original_lines: &[&str],
    modified_lines: &[&str],
    style: SingleLineStyle,
    available_width: usize,
  ) -> HashMap<usize, String> {
    let mut collapsed: HashMap<usize, String> = HashMap::new();

    if !is_color_enabled() {
      return collapsed;
    }

    if hunk.lines.is_empty() {
      return collapsed;
    }

    let mut index = 0;

    while index < hunk.lines.len() - 1 {
      let removed = &hunk.lines[index];
      let added = &hunk.lines[index + 1];

      if removed.line_type != DiffLineType::Removed || added.line_type != DiffLineType::Added {
        index += 1;

        continue;
      }

      if hunk.lines.get(index + 2).map(|line| line.line_type) == Some(DiffLineType::Added) {
        index += 1;

        continue;
      }

      if index > 0 && hunk.lines[index - 1].line_type == DiffLineType::Removed {
        index += 1;

        continue;
      }

      let (Some(removed_ranges), Some(added_ranges)) = (inline_ranges.get(&index), inline_ranges.get(&(index + 1))) else {
        index += 1;

        continue;
      };

      if removed_ranges.len() > 1 || added_ranges.len() > 1 {
        index += 1;

        continue;
      }

      if removed_ranges.is_empty() && added_ranges.is_empty() {
        index += 1;

        continue;
      }

      let start = removed_ranges
        .first()
        .map(|range| range.start)
        .unwrap_or(usize::MAX)
        .min(added_ranges.first().map(|range| range.start).unwrap_or(usize::MAX));

      let removed_end = removed_ranges.first().map(|range| range.end).unwrap_or(start);
      let added_end = added_ranges.first().map(|range| range.end).unwrap_or(start);

      if style == SingleLineStyle::Auto && !self.worth_collapsing(removed, added, start, removed_end, added_end, available_width) {
        index += 1;

        continue;
      }

      let removed_text = original_lines
        .get(removed.old_line_number.expect("removed lines carry an old line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| removed.content.clone());

      let added_text = modified_lines
        .get(added.new_line_number.expect("added lines carry a new line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| added.content.clone());

      let prefix = slice_styled(&added_text, 0, start);
      let suffix = slice_styled(&added_text, added_end, added.content.chars().count());

      let removed_span = if removed_end > start {
        apply_background(
          &slice_styled(&removed_text, start, removed_end),
          &BackgroundOptions {
            line_color: self.colors.diff_removed_background,
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
            line_color: self.colors.diff_added_background,
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

  fn worth_collapsing(&self, removed: &DiffLine, added: &DiffLine, start: usize, removed_end: usize, added_end: usize, available_width: usize) -> bool {
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

  fn collapsed_gutter_for(&self, line: &DiffLine) -> String {
    let number = format_line_number(line.old_line_number);

    format!("{}{} ", colorize("  ± ", NamedColor::Yellow), colorize(&number, NamedColor::Bold))
  }

  fn highlighted_content_for(&self, line: &DiffLine, original_lines: &[&str], modified_lines: &[&str]) -> String {
    if line.line_type == DiffLineType::Added {
      return modified_lines
        .get(line.new_line_number.expect("added lines carry a new line number") - 1)
        .map(|line| line.to_string())
        .unwrap_or_else(|| line.content.clone());
    }

    original_lines
      .get(line.old_line_number.expect("context and removed lines carry an old line number") - 1)
      .map(|content| content.to_string())
      .unwrap_or_else(|| line.content.clone())
  }

  fn marker_for(&self, line: &DiffLine) -> String {
    match line.line_type {
      DiffLineType::Added => colorize("+ ", ADDED_COLOR),
      DiffLineType::Removed => colorize("- ", REMOVED_COLOR),
      DiffLineType::Context => "  ".to_string(),
    }
  }

  fn gutter_for(&self, line: &DiffLine, numbering: Numbering) -> String {
    let line_number = if numbering == Numbering::New {
      line.new_line_number
    } else {
      line.old_line_number
    };
    let number = format_line_number(line_number);

    let emphasized = if line_number.is_none() {
      number.clone()
    } else {
      colorize(&number, NamedColor::Bold)
    };

    match line.line_type {
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

fn fill(lines: &mut Vec<String>, index: usize, content: String) {
  while lines.len() <= index {
    lines.push(String::new());
  }

  lines[index] = content;
}
