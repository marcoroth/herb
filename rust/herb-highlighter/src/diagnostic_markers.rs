use crate::diagnostic::SerializedLocation;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiagnosticMarker {
  pub line: usize,
  pub start: usize,
  pub end: usize,
}

pub fn compute_diagnostic_markers(location: &SerializedLocation, lines: &[&str]) -> Vec<DiagnosticMarker> {
  let start_line = location.start.line.max(1);
  let end_line = start_line.max(location.end.line.min(lines.len().max(start_line)));

  let mut markers: Vec<DiagnosticMarker> = Vec::new();

  for line_number in start_line..=end_line {
    let line = lines.get(line_number - 1).copied().unwrap_or("");
    let is_first_line = line_number == start_line;
    let is_last_line = line_number == location.end.line;

    let start = if is_first_line {
      location.start.column
    } else {
      line.chars().count() - line.trim_start().chars().count()
    };

    let end = if is_last_line { location.end.column } else { line.trim_end().chars().count() };

    if end > start {
      markers.push(DiagnosticMarker { line: line_number, start, end });
    }
  }

  if markers.is_empty() {
    let start = location.start.column;

    markers.push(DiagnosticMarker {
      line: start_line,
      start,
      end: start + 1,
    });
  }

  markers
}
