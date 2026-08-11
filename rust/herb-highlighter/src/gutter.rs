use crate::color::{colorize, Color, NamedColor};

// The width of the gutter, in the format "    123 │ ":
// - 4 spaces of indentation
// - 3 characters for the line number (supports up to 999 lines)
// - 1 space after the line number
// - 1 character for the separator (│)
// - 1 space after the separator
pub const GUTTER_WIDTH: usize = 4 + 3 + 1 + 1 + 1;
pub const MIN_CONTENT_WIDTH: usize = 40;

pub fn separator() -> String {
  colorize("│", NamedColor::Gray)
}

pub fn line_number(number: usize, emphasized: bool) -> String {
  let text = format!("{number:>3}");

  colorize(&text, if emphasized { NamedColor::Bold } else { NamedColor::Gray })
}

pub fn marker_prefix(marker: Option<Color>) -> String {
  match marker {
    Some(color) => colorize("  → ", color),
    None => "    ".to_string(),
  }
}

pub fn line_prefix(number: usize, emphasized: bool, marker: Option<Color>) -> String {
  format!("{}{} {} ", marker_prefix(marker), line_number(number, emphasized), separator())
}

pub fn continuation_prefix() -> String {
  format!("        {} ", separator())
}

pub fn pointer_prefix() -> String {
  format!("        {}", separator())
}

pub fn available_width(max_width: usize) -> usize {
  MIN_CONTENT_WIDTH.max(max_width.saturating_sub(GUTTER_WIDTH))
}
