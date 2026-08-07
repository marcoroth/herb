use std::fmt::Write as _;

use crate::ansi::{ansi_sequence_at_start, split_capturing_ansi};
use crate::color::{colors, is_color_enabled, is_terminal};

pub struct TextFormatter;

impl TextFormatter {
  pub fn dim_ansi_codes(text: &str) -> String {
    if !is_color_enabled() {
      return text.to_string();
    }

    let mut result = String::new();

    for part in split_capturing_ansi(text) {
      if ansi_sequence_at_start(part).is_some() {
        let codes = &part[2..part.len() - 1];

        if codes == "0" || codes.is_empty() {
          result.push_str(part);
        } else {
          let _ = write!(result, "\x1b[2;{codes}m");
        }
      } else {
        result.push_str(part);
      }
    }

    result
  }

  pub fn highlight_backticks(text: &str) -> String {
    if !(is_terminal() && is_color_enabled()) {
      return text.to_string();
    }

    replace_backticks(text, &format!("{}{}", colors::BOLD, colors::WHITE), colors::RESET)
  }
}

pub(crate) fn replace_backticks(text: &str, prefix: &str, suffix: &str) -> String {
  let mut result = String::with_capacity(text.len());
  let mut rest = text;

  while let Some(opening) = rest.find('`') {
    let after_opening = &rest[opening + 1..];

    match after_opening.find('`') {
      Some(closing) if closing > 0 => {
        result.push_str(&rest[..opening]);
        result.push_str(prefix);
        result.push_str(&after_opening[..closing]);
        result.push_str(suffix);

        rest = &after_opening[closing + 1..];
      }

      _ => {
        result.push_str(&rest[..opening + 1]);

        rest = after_opening;
      }
    }
  }

  result.push_str(rest);

  result
}
