mod common;

use herb_highlighter::ansi::{find_ansi_sequences, split_capturing_ansi, ANSI_ESCAPE};
use herb_highlighter::color::{colorize, colors, Color, NamedColor};
use herb_highlighter::line_wrapper::LineWrapper;
use herb_highlighter::text_formatter::TextFormatter;
use herb_highlighter::util::dim_styled_text;

use common::{no_color, strip_ansi_colors, with_color, with_terminal, without_terminal};

#[test]
fn ansi_escape_matches_the_esc_control_character() {
  assert_eq!(ANSI_ESCAPE, '\u{1b}');
  assert_eq!(ANSI_ESCAPE as u32, 0x1b);
}

#[test]
fn ansi_sequences_matches_ansi_color_codes() {
  assert_eq!(find_ansi_sequences("hello \x1b[31mworld\x1b[0m"), vec!["\x1b[31m", "\x1b[0m"]);
}

#[test]
fn ansi_sequences_matches_codes_with_multiple_parameters() {
  assert_eq!(find_ansi_sequences("\x1b[38;2;255;0;0m"), vec!["\x1b[38;2;255;0;0m"]);
}

#[test]
fn ansi_sequences_does_not_match_plain_text() {
  assert!(find_ansi_sequences("hello world").is_empty());
}

#[test]
fn ansi_sequence_at_start_matches_ansi_code_at_string_start() {
  assert!(herb_highlighter::ansi::ansi_sequence_at_start("\x1b[31mhello").is_some());
}

#[test]
fn ansi_sequence_at_start_does_not_match_ansi_code_mid_string() {
  assert!(herb_highlighter::ansi::ansi_sequence_at_start("hello\x1b[31m").is_none());
}

#[test]
fn split_capturing_ansi_splits_text_preserving_ansi_codes() {
  let text = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(split_capturing_ansi(&text), vec!["", colors::RED, "hello", colors::RESET, ""]);
}

#[test]
fn split_capturing_ansi_splits_text_with_multiple_colors() {
  let text = format!("{}a{}b{}", colors::RED, colors::BLUE, colors::RESET);

  assert_eq!(split_capturing_ansi(&text), vec!["", colors::RED, "a", colors::BLUE, "b", colors::RESET, ""]);
}

#[test]
fn strip_ansi_colors_removes_all_ansi_codes_from_text() {
  let styled = format!("{}hello{} {}world{}", colors::RED, colors::RESET, colors::BLUE, colors::RESET);

  assert_eq!(strip_ansi_colors(&styled), "hello world");
}

#[test]
fn strip_ansi_colors_returns_plain_text_unchanged() {
  assert_eq!(strip_ansi_colors("hello world"), "hello world");
}

#[test]
fn strip_ansi_colors_handles_empty_string() {
  assert_eq!(strip_ansi_colors(""), "");
}

#[test]
fn strip_ansi_colors_handles_text_with_only_ansi_codes() {
  assert_eq!(strip_ansi_colors(&format!("{}{}", colors::RED, colors::RESET)), "");
}

#[test]
fn strip_ansi_colors_handles_rgb_color_codes() {
  assert_eq!(strip_ansi_colors("\x1b[38;2;255;0;0mred text\x1b[0m"), "red text");
}

#[test]
fn apply_dim_adds_dim_modifier_to_color_codes_and_wraps_text_segments() {
  with_color();

  let input = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(dim_styled_text(&input), "\x1b[2;31m\x1b[2mhello\x1b[22m\x1b[0m");
}

#[test]
fn apply_dim_wraps_plain_text_segments_with_dim() {
  with_color();

  let input = format!("{}colored{} plain", colors::RED, colors::RESET);

  assert_eq!(dim_styled_text(&input), "\x1b[2;31m\x1b[2mcolored\x1b[22m\x1b[0m\x1b[2m plain\x1b[22m");
}

#[test]
fn apply_dim_returns_text_unchanged_when_color_is_off() {
  no_color();

  let input = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(dim_styled_text(&input), input);
}

#[test]
fn apply_dim_handles_text_with_no_ansi_codes() {
  with_color();

  assert_eq!(dim_styled_text("plain text"), "\x1b[2mplain text\x1b[22m");
}

#[test]
fn apply_dim_handles_empty_string() {
  with_color();

  assert_eq!(dim_styled_text(""), "");
}

#[test]
fn apply_dim_handles_multiple_color_codes() {
  with_color();

  let input = format!("{}red{}{}blue{}", colors::RED, colors::RESET, colors::BLUE, colors::RESET);

  assert_eq!(
    dim_styled_text(&input),
    "\x1b[2;31m\x1b[2mred\x1b[22m\x1b[0m\x1b[2;34m\x1b[2mblue\x1b[22m\x1b[0m"
  );
}

#[test]
fn text_formatter_converts_color_codes_to_dim_versions() {
  with_color();

  let input = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(TextFormatter::dim_ansi_codes(&input), "\x1b[2;31mhello\x1b[0m");
}

#[test]
fn text_formatter_preserves_reset_codes() {
  with_color();

  let input = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(TextFormatter::dim_ansi_codes(&input), "\x1b[2;31mhello\x1b[0m");
}

#[test]
fn text_formatter_returns_text_unchanged_when_color_is_off() {
  no_color();

  let input = format!("{}hello{}", colors::RED, colors::RESET);

  assert_eq!(TextFormatter::dim_ansi_codes(&input), input);
}

#[test]
fn text_formatter_handles_text_with_no_ansi_codes() {
  with_color();

  assert_eq!(TextFormatter::dim_ansi_codes("plain text"), "plain text");
}

#[test]
fn highlight_backticks_wraps_backtick_content_with_bold_white() {
  with_color();
  with_terminal();

  assert_eq!(
    TextFormatter::highlight_backticks("use `foo` here"),
    format!("use {}{}foo{} here", colors::BOLD, colors::WHITE, colors::RESET)
  );
}

#[test]
fn highlight_backticks_handles_multiple_backtick_pairs() {
  with_color();
  with_terminal();

  assert_eq!(
    TextFormatter::highlight_backticks("`a` and `b`"),
    format!(
      "{}{}a{} and {}{}b{}",
      colors::BOLD,
      colors::WHITE,
      colors::RESET,
      colors::BOLD,
      colors::WHITE,
      colors::RESET
    )
  );
}

#[test]
fn highlight_backticks_returns_text_unchanged_when_color_is_off() {
  no_color();
  with_terminal();

  assert_eq!(TextFormatter::highlight_backticks("use `foo` here"), "use `foo` here");
}

#[test]
fn highlight_backticks_returns_text_unchanged_without_a_terminal() {
  with_color();
  without_terminal();

  assert_eq!(TextFormatter::highlight_backticks("use `foo` here"), "use `foo` here");
}

#[test]
fn highlight_backticks_returns_text_without_backticks_unchanged() {
  with_color();
  with_terminal();

  assert_eq!(TextFormatter::highlight_backticks("plain text"), "plain text");
}

#[test]
fn colorize_wraps_text_with_foreground_color_and_reset() {
  with_color();

  assert_eq!(colorize("hello", NamedColor::Red), format!("{}hello{}", colors::RED, colors::RESET));
}

#[test]
fn colorize_supports_hex_colors() {
  with_color();

  assert_eq!(colorize("hello", Color::Rgb(255, 0, 0)), "\x1b[38;2;255;0;0mhello\x1b[0m");
}

#[test]
fn colorize_supports_background_colors() {
  with_color();

  assert_eq!(
    herb_highlighter::color::colorize_with_background("hello", NamedColor::Red, NamedColor::Blue),
    format!("{}{}hello{}", colors::BLUE, colors::RED, colors::RESET)
  );
}

#[test]
fn colorize_returns_plain_text_when_color_is_off() {
  no_color();

  assert_eq!(colorize("hello", NamedColor::Red), "hello");
}

#[test]
fn wrap_line_returns_line_as_is_when_shorter_than_max_width() {
  assert_eq!(LineWrapper::wrap_line("short", 80, ""), vec!["short"]);
}

#[test]
fn wrap_line_returns_line_as_is_when_max_width_is_zero() {
  assert_eq!(LineWrapper::wrap_line("hello", 0, ""), vec!["hello"]);
}

#[test]
fn wrap_line_wraps_long_plain_text_at_whitespace() {
  assert_eq!(LineWrapper::wrap_line("hello world foo", 11, ""), vec!["hello ", "world foo"]);
}

#[test]
fn wrap_line_preserves_ansi_codes_when_wrapping() {
  with_color();

  let styled = format!("{}hello world{} {}and more text{}", colors::RED, colors::RESET, colors::BLUE, colors::RESET);

  let result = LineWrapper::wrap_line(&styled, 15, "");

  assert!(result.len() > 1);
  assert_eq!(result[0], format!("{}hello world{} ", colors::RED, colors::RESET));
}

#[test]
fn wrap_line_calculates_width_ignoring_ansi_codes() {
  with_color();

  let styled = format!("{}short{}", colors::RED, colors::RESET);

  assert_eq!(LineWrapper::wrap_line(&styled, 80, ""), vec![styled]);
}

#[test]
fn truncate_line_returns_line_as_is_when_shorter_than_max_width() {
  assert_eq!(LineWrapper::truncate_line("short", 80), "short");
}

#[test]
fn truncate_line_returns_line_as_is_when_max_width_is_zero() {
  assert_eq!(LineWrapper::truncate_line("hello", 0), "hello");
}

#[test]
fn truncate_line_truncates_long_lines_with_ellipsis() {
  with_color();

  let long_line = "a".repeat(100);
  let result = LineWrapper::truncate_line(&long_line, 20);
  let stripped = strip_ansi_colors(&result);

  assert!(stripped.chars().count() <= 20);
  assert!(stripped.ends_with('…'));
  assert!(stripped.trim_end_matches('…').chars().all(|character| character == 'a'));
}

#[test]
fn truncate_line_preserves_ansi_codes_in_truncated_output() {
  with_color();

  let styled = format!("{}{}{}", colors::RED, "a".repeat(100), colors::RESET);
  let result = LineWrapper::truncate_line(&styled, 20);

  assert!(result.starts_with(colors::RED));
  assert!(strip_ansi_colors(&result).chars().count() <= 20);
}

#[test]
fn truncate_line_calculates_width_ignoring_ansi_codes() {
  with_color();

  let styled = format!("{}short{}", colors::RED, colors::RESET);

  assert_eq!(LineWrapper::truncate_line(&styled, 80), styled);
}

#[test]
fn wrap_line_preserves_color_codes_that_span_a_wrap_boundary() {
  with_color();

  let styled = format!("{}{}{}", colors::RED, "abcdefghij".repeat(3), colors::RESET);
  let result = LineWrapper::wrap_line(&styled, 15, "");

  assert!(result.len() > 1);
  assert!(result[0].starts_with(colors::RED));
}

#[test]
fn wrap_line_handles_text_with_only_ansi_codes_and_no_visible_content_beyond_width() {
  with_color();

  let styled = format!("{}{}{}short", colors::RED, colors::BLUE, colors::RESET);
  let result = LineWrapper::wrap_line(&styled, 80, "");

  assert_eq!(result.len(), 1);
  assert_eq!(strip_ansi_colors(&result[0]), "short");
}

#[test]
fn truncate_line_preserves_color_in_truncated_portion() {
  with_color();

  let styled = format!("{}hello{} {}{}{}", colors::RED, colors::RESET, colors::BLUE, "x".repeat(100), colors::RESET);

  let result = LineWrapper::truncate_line(&styled, 20);
  let stripped = strip_ansi_colors(&result);

  assert!(result.starts_with(colors::RED));
  assert!(stripped.starts_with("hello"));
  assert!(stripped.chars().count() <= 20);
}

#[test]
fn truncate_line_handles_adjacent_ansi_codes_at_truncation_point() {
  with_color();

  let styled = format!("{}{}{}{}{}", "a".repeat(15), colors::RED, colors::BOLD, "b".repeat(100), colors::RESET);
  let result = LineWrapper::truncate_line(&styled, 20);
  let stripped = strip_ansi_colors(&result);

  assert!(stripped.chars().count() <= 20);
  assert!(stripped.starts_with('a'));
}

#[test]
fn truncate_line_handles_rgb_color_codes_in_truncated_content() {
  with_color();

  let styled = colorize(&"x".repeat(100), Color::Rgb(0xFF, 0x80, 0x00));
  let result = LineWrapper::truncate_line(&styled, 20);
  let stripped = strip_ansi_colors(&result);

  assert!(result.starts_with(ANSI_ESCAPE));
  assert!(stripped.chars().count() <= 20);
}
