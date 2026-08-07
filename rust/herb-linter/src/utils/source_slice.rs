use herb::{Location, Position};

pub fn offset_of(source: &str, line: u32, column: u32) -> Option<usize> {
  let mut current_line = 1;
  let mut offset = 0;

  for source_line in source.split_inclusive('\n') {
    if current_line == line {
      let column_offset: usize = source_line.chars().take(column as usize).map(char::len_utf8).sum();

      return Some(offset + column_offset);
    }

    offset += source_line.len();
    current_line += 1;
  }

  if current_line == line {
    Some(offset)
  } else {
    None
  }
}

pub fn identity_print(source: &str, location: &Location) -> String {
  let start = match offset_of(source, location.start.line, location.start.column) {
    Some(start) => start,
    None => return String::new(),
  };

  let end = match offset_of(source, location.end.line, location.end.column) {
    Some(end) => end,
    None => return String::new(),
  };

  if start > end || end > source.len() {
    return String::new();
  }

  source[start..end].to_string()
}

pub fn position_from_offset(source: &str, offset: usize) -> Position {
  let mut line = 1;
  let mut column = 0;
  let mut bytes = 0;

  for character in source.chars() {
    if bytes >= offset {
      break;
    }

    bytes += character.len_utf8();

    if character == '\n' {
      line += 1;
      column = 0;
    } else {
      column += character.len_utf16() as u32;
    }
  }

  Position::new(line, column)
}

pub fn location_from_offset(source: &str, start_offset: usize, end_offset: usize) -> Location {
  Location::new(position_from_offset(source, start_offset), position_from_offset(source, end_offset))
}

pub fn location_from_content_offset(start_line: u32, start_column: u32, content: &str, offset: usize) -> Location {
  let mut line = start_line;
  let mut column = start_column;

  for character in content[..offset].chars() {
    if character == '\n' {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }

  Location::new(Position::new(line, column), Position::new(line, column + 1))
}

/// Collapses each whitespace run that contains a newline into a single space,
/// mirroring `replace(/\s*\n\s*/g, " ")`. Runs without a newline are left as
/// written, so `<%=  value %>` keeps its spacing.
pub fn collapse_newline_runs(value: &str) -> String {
  let mut result = String::with_capacity(value.len());
  let mut rest = value;

  while let Some(start) = rest.find(char::is_whitespace) {
    result.push_str(&rest[..start]);

    let run = &rest[start..];
    let length = run.find(|character: char| !character.is_whitespace()).unwrap_or(run.len());
    let (run, remainder) = run.split_at(length);

    if run.contains('\n') {
      result.push(' ');
    } else {
      result.push_str(run);
    }

    rest = remainder;
  }

  result.push_str(rest);

  result
}
