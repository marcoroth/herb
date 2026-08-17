use herb_highlighter::diagnostic::SerializedLocation;
use herb_highlighter::diagnostic_markers::{compute_diagnostic_markers, DiagnosticMarker};

fn location(start_line: usize, start_column: usize, end_line: usize, end_column: usize) -> SerializedLocation {
  SerializedLocation::from(start_line, start_column, end_line, end_column)
}

fn marker(line: usize, start: usize, end: usize) -> DiagnosticMarker {
  DiagnosticMarker { line, start, end }
}

#[test]
fn returns_a_single_marker_for_a_single_line_diagnostic() {
  let lines = vec!["<div>", "  <span>content</span>", "</div>"];

  assert_eq!(compute_diagnostic_markers(&location(2, 2, 2, 8), &lines), vec![marker(2, 2, 8)]);
}

#[test]
fn returns_a_marker_per_line_for_a_multi_line_diagnostic() {
  let lines = vec![
    "<div id=\"gems\">",
    "  <% @gems.each do |topic_gem| %>",
    "    <%= render partial: \"gem_card\" %>",
    "  <% end %>",
    "</div>",
  ];

  assert_eq!(
    compute_diagnostic_markers(&location(2, 2, 4, 11), &lines),
    vec![marker(2, 2, 33), marker(3, 4, 37), marker(4, 2, 11)]
  );
}

#[test]
fn marks_intermediate_lines_across_their_non_whitespace_content_only() {
  let lines = vec!["<% if true %>", "      indented      ", "<% end %>"];

  assert_eq!(
    compute_diagnostic_markers(&location(1, 0, 3, 9), &lines),
    vec![marker(1, 0, 13), marker(2, 6, 14), marker(3, 0, 9)]
  );
}

#[test]
fn skips_blank_and_whitespace_only_lines_inside_the_span() {
  let lines = vec!["<% if true %>", "", "    ", "<% end %>"];

  let markers = compute_diagnostic_markers(&location(1, 0, 4, 9), &lines);

  assert_eq!(markers.iter().map(|marker| marker.line).collect::<Vec<_>>(), vec![1, 4]);
}

#[test]
fn skips_the_last_line_when_the_diagnostic_ends_at_its_first_column() {
  let lines = vec!["<% if true %>", "  content", "<% end %>"];

  let markers = compute_diagnostic_markers(&location(1, 0, 3, 0), &lines);

  assert_eq!(markers.iter().map(|marker| marker.line).collect::<Vec<_>>(), vec![1, 2]);
}

#[test]
fn falls_back_to_a_single_character_marker_for_a_zero_width_diagnostic() {
  let lines = vec!["<div>", "  <span>", "</div>"];

  assert_eq!(compute_diagnostic_markers(&location(2, 4, 2, 4), &lines), vec![marker(2, 4, 5)]);
}

#[test]
fn clamps_the_end_line_to_the_available_content() {
  let lines = vec!["<% if true %>", "  content"];

  let markers = compute_diagnostic_markers(&location(1, 0, 99, 5), &lines);

  assert_eq!(markers.iter().map(|marker| marker.line).collect::<Vec<_>>(), vec![1, 2]);
}
