use std::env;

use crate::ansi::{ansi_sequence_at_start, strip_ansi, visible_width};
use crate::color::{colorize, is_terminal, NamedColor};

pub struct LineWrapper;

impl LineWrapper {
  pub fn wrap_line(line: &str, max_width: usize, indent: &str) -> Vec<String> {
    if max_width == 0 {
      return vec![line.to_string()];
    }

    let plain_line: Vec<char> = strip_ansi(line).chars().collect();

    if plain_line.len() <= max_width {
      return vec![line.to_string()];
    }

    let mut wrapped_lines: Vec<String> = Vec::new();
    let mut current_line = line.to_string();
    let mut current_plain = plain_line;

    while current_plain.len() > max_width {
      let mut break_point = max_width;

      for index in (max_width.saturating_sub(40)..max_width).rev() {
        let character = current_plain[index];

        if character == ' ' || character == '\t' {
          break_point = index + 1;
          break;
        }
      }

      if break_point == max_width {
        for index in (max_width.saturating_sub(30)..max_width).rev() {
          let character = current_plain[index];
          let previous_character = if index > 0 { current_plain[index - 1] } else { '\0' };
          let next_character = if index < current_plain.len() - 1 { current_plain[index + 1] } else { '\0' };

          if (character == '>' || character == ',' || character == ';') && previous_character != '=' && next_character != '"' && next_character != '\'' {
            break_point = index + 1;

            break;
          }
        }
      }

      if break_point == max_width {
        for index in (max_width.saturating_sub(10)..max_width).rev() {
          let character = current_plain[index];

          if character != '=' && character != '"' && character != '\'' {
            break_point = index;

            break;
          }
        }
      }

      let break_point = break_point.max(1);

      wrapped_lines.push(Self::extract_portion_with_ansi(&current_line, break_point));
      current_line = Self::extract_remaining_with_ansi(&current_line, break_point);
      current_plain = current_plain[break_point..].iter().copied().collect::<String>().trim_start().chars().collect();

      if !current_plain.is_empty() {
        current_line = format!("{indent}{}", current_line.trim_start());
      }
    }

    if !current_plain.is_empty() {
      wrapped_lines.push(current_line);
    }

    wrapped_lines
  }

  fn extract_portion_with_ansi(styled_line: &str, end_index: usize) -> String {
    let mut styled_index = 0;
    let mut plain_index = 0;
    let mut result = String::new();

    while plain_index < end_index && styled_index < styled_line.len() {
      if let Some(sequence) = ansi_sequence_at_start(&styled_line[styled_index..]) {
        result.push_str(sequence);
        styled_index += sequence.len();

        continue;
      }

      let character = styled_line[styled_index..].chars().next().unwrap_or('\0');

      result.push(character);
      styled_index += character.len_utf8();
      plain_index += 1;
    }

    result
  }

  fn extract_remaining_with_ansi(styled_line: &str, start_index: usize) -> String {
    let mut styled_index = 0;
    let mut plain_index = 0;

    while plain_index < start_index && styled_index < styled_line.len() {
      if let Some(sequence) = ansi_sequence_at_start(&styled_line[styled_index..]) {
        styled_index += sequence.len();

        continue;
      }

      let character = styled_line[styled_index..].chars().next().unwrap_or('\0');

      styled_index += character.len_utf8();
      plain_index += 1;
    }

    styled_line[styled_index..].to_string()
  }

  pub fn truncate_line(line: &str, max_width: usize) -> String {
    if max_width == 0 {
      return line.to_string();
    }

    if visible_width(line) <= max_width {
      return line.to_string();
    }

    let ellipsis_character = "…";
    let ellipsis = colorize(ellipsis_character, NamedColor::Dim);
    let right_padding = 2;
    let available_width = max_width as isize - ellipsis_character.chars().count() as isize - right_padding;

    if available_width <= 0 {
      return ellipsis;
    }

    let truncated_portion = Self::extract_portion_with_ansi(line, available_width as usize);

    format!("{truncated_portion}{ellipsis}")
  }

  pub fn get_terminal_width() -> usize {
    if is_terminal() {
      if let Some(columns) = env::var("COLUMNS").ok().and_then(|value| value.parse::<usize>().ok()) {
        if columns > 0 {
          return columns;
        }
      }
    }

    80
  }
}
