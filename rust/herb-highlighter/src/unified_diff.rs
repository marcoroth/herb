use serde::{Deserialize, Serialize};

use crate::diff_computer::{DiffHunk, DiffLine, DiffLineType};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedFile {
  pub path: String,
  pub hunks: Vec<DiffHunk>,
}

fn parse_hunk_header(line: &str) -> Option<(usize, usize)> {
  let rest = line.strip_prefix("@@ -")?;

  let (old_range, rest) = rest.split_once(" +")?;
  let (new_range, _) = rest.split_once(" @@")?;

  let old_line = old_range.split(',').next()?.parse().ok()?;
  let new_line = new_range.split(',').next()?.parse().ok()?;

  Some((old_line, new_line))
}

pub fn parse_unified_diff(text: &str) -> Vec<ParsedFile> {
  let mut files: Vec<ParsedFile> = Vec::new();

  let mut has_open_hunk = false;
  let mut old_line = 0;
  let mut new_line = 0;

  for line in text.split('\n') {
    if let Some(path) = line.strip_prefix("+++ ") {
      let path = path.trim();
      let path = path.strip_prefix("b/").unwrap_or(path);

      if path != "/dev/null" {
        match files.last_mut() {
          Some(open) if open.hunks.is_empty() => open.path = path.to_string(),

          _ => {
            files.push(ParsedFile {
              path: path.to_string(),
              hunks: Vec::new(),
            });

            has_open_hunk = false;
          }
        }
      }

      continue;
    }

    if line.starts_with("--- ") || line.starts_with("diff --git ") {
      if files.last().is_none_or(|open| !open.hunks.is_empty()) {
        files.push(ParsedFile {
          path: String::new(),
          hunks: Vec::new(),
        });

        has_open_hunk = false;
      }

      continue;
    }

    if let Some((header_old_line, header_new_line)) = parse_hunk_header(line) {
      if files.is_empty() {
        files.push(ParsedFile {
          path: String::new(),
          hunks: Vec::new(),
        });
      }

      old_line = header_old_line;
      new_line = header_new_line;
      has_open_hunk = true;

      files.last_mut().expect("a file is open").hunks.push(DiffHunk {
        old_start: old_line,
        old_count: 0,
        new_start: new_line,
        new_count: 0,
        lines: Vec::new(),
      });

      continue;
    }

    if !has_open_hunk {
      continue;
    }

    if line.starts_with('\\') {
      continue;
    }

    let marker = line.chars().next();
    let content = line.get(1..).unwrap_or("").to_string();

    let hunk = files.last_mut().expect("a file is open").hunks.last_mut().expect("a hunk is open");

    match marker {
      Some(' ') | None => {
        hunk.lines.push(DiffLine {
          line_type: DiffLineType::Context,
          content,
          old_line_number: Some(old_line),
          new_line_number: Some(new_line),
        });

        old_line += 1;
        new_line += 1;
        hunk.old_count += 1;
        hunk.new_count += 1;
      }

      Some('-') => {
        hunk.lines.push(DiffLine {
          line_type: DiffLineType::Removed,
          content,
          old_line_number: Some(old_line),
          new_line_number: None,
        });

        old_line += 1;
        hunk.old_count += 1;
      }

      Some('+') => {
        hunk.lines.push(DiffLine {
          line_type: DiffLineType::Added,
          content,
          old_line_number: None,
          new_line_number: Some(new_line),
        });

        new_line += 1;
        hunk.new_count += 1;
      }

      _ => has_open_hunk = false,
    }
  }

  files.into_iter().filter(|entry| !entry.hunks.is_empty()).collect()
}
