use std::fmt::Write as _;

use crate::ansi::{ansi_sequence_at_start, split_capturing_ansi};
use crate::color::{colors, is_color_enabled, Color};

const BACKGROUND_RESET: &str = "\x1b[49m";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BackgroundRange {
  pub start: usize,
  pub end: usize,
}

#[derive(Debug, Clone, Default)]
pub struct BackgroundOptions<'a> {
  pub line_color: Option<Color>,
  pub ranges: &'a [BackgroundRange],
  pub range_color: Option<Color>,
}

pub fn apply_background(text: &str, options: &BackgroundOptions<'_>) -> String {
  let BackgroundOptions {
    line_color,
    ranges,
    range_color,
  } = options;

  if !is_color_enabled() {
    return text.to_string();
  }

  if line_color.is_none() && (ranges.is_empty() || range_color.is_none()) {
    return text.to_string();
  }

  let line_background = line_color.map(|color| color.background().into_owned()).unwrap_or_default();
  let range_background = range_color.map(|color| color.background().into_owned()).unwrap_or_default();

  let parts = split_capturing_ansi(text);

  let mut plain_index = 0;
  let mut active = String::new();
  let mut result = String::new();

  for part in parts {
    if part.is_empty() {
      continue;
    }

    if ansi_sequence_at_start(part).is_some() {
      result.push_str(part);

      if part == colors::RESET {
        active.clear();
      }

      continue;
    }

    for character in part.chars() {
      let in_range = !range_background.is_empty() && ranges.iter().any(|range| plain_index >= range.start && plain_index < range.end);
      let desired = if in_range { &range_background } else { &line_background };

      if *desired != active {
        result.push_str(if desired.is_empty() { BACKGROUND_RESET } else { desired });
        active = desired.clone();
      }

      result.push(character);
      plain_index += 1;
    }
  }

  if !active.is_empty() {
    result.push_str(BACKGROUND_RESET);
  }

  result
}

pub fn slice_styled(text: &str, start: usize, end: usize) -> String {
  if !is_color_enabled() {
    return text.chars().skip(start).take(end.saturating_sub(start)).collect();
  }

  let parts = split_capturing_ansi(text);

  let mut plain_index = 0;
  let mut active: Vec<&str> = Vec::new();
  let mut result = String::new();
  let mut opened = false;

  for part in parts {
    if part.is_empty() {
      continue;
    }

    if ansi_sequence_at_start(part).is_some() {
      if plain_index <= start {
        if part == colors::RESET {
          active.clear();
        } else {
          active.push(part);
        }
      } else if plain_index < end {
        result.push_str(part);
      }

      continue;
    }

    for character in part.chars() {
      if plain_index >= end {
        break;
      }

      if plain_index >= start {
        if !opened {
          result.push_str(&active.concat());
          opened = true;
        }

        result.push(character);
      }

      plain_index += 1;
    }
  }

  if !result.is_empty() && (opened || !active.is_empty()) {
    result.push_str(colors::RESET);
  }

  result
}

pub fn dim_styled_text(text: &str) -> String {
  if !is_color_enabled() {
    return text.to_string();
  }

  let parts = split_capturing_ansi(text);

  let mut result = String::new();

  for part in parts {
    if ansi_sequence_at_start(part).is_some() {
      if part == colors::RESET {
        result.push_str(part);
      } else {
        let codes = &part[2..part.len() - 1];

        if !codes.is_empty() && codes != "0" {
          let _ = write!(result, "\x1b[2;{codes}m");
        } else {
          result.push_str(part);
        }
      }
    } else if !part.is_empty() {
      let _ = write!(result, "{}{}\x1b[22m", colors::DIM, part);
    }
  }

  result
}
