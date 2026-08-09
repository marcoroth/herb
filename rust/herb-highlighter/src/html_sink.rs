use crate::diagnostic::DiagnosticSeverity;
use crate::diff_computer::DiffLineType;
use crate::diff_renderer::DiffLayout;
use crate::document::{Annotation, CodeBlockKind, DiffHunkInfo, DiffRowInfo, Document, InlineRangeInfo, LineEmphasis, LineInfo, Node, StyleRole, StyledRun};
use crate::text_formatter::replace_backticks;
use crate::themes::DEFAULT_THEME;

pub const HYDRATION_SCRIPT: &str = include_str!("../../../javascript/packages/highlighter/assets/herb-markers.js");

pub struct HTMLRenderOptions {
  pub focus_line: Option<usize>,
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub theme_label: String,
}

impl Default for HTMLRenderOptions {
  fn default() -> Self {
    Self {
      focus_line: None,
      context_lines: 2,
      show_line_numbers: true,
      theme_label: DEFAULT_THEME.as_str().to_string(),
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MarkerMode {
  HighlightApi,
  #[default]
  Spans,
}

pub struct HTMLSinkOptions {
  pub theme_label: String,
  pub show_line_numbers: bool,
  pub markers: MarkerMode,
  pub diff_layout: DiffLayout,
}

impl Default for HTMLSinkOptions {
  fn default() -> Self {
    Self {
      theme_label: DEFAULT_THEME.as_str().to_string(),
      show_line_numbers: true,
      markers: MarkerMode::Spans,
      diff_layout: DiffLayout::Unified,
    }
  }
}

pub fn escape_html(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&#39;")
}

pub fn kebab(value: &str) -> String {
  value.to_lowercase().replace('_', "-")
}

pub fn class_for_role(role: &StyleRole) -> Option<String> {
  match role {
    StyleRole::Plain => None,
    StyleRole::Token(token_type) => Some(format!("herb-{}", kebab(token_type))),
    StyleRole::RubyKeyword => Some("herb-ruby-keyword".to_string()),
    StyleRole::TagName => Some("herb-tag-name".to_string()),
    StyleRole::AttributeName => Some("herb-attr-name".to_string()),
    StyleRole::AttributeValue => Some("herb-attr-value".to_string()),
    StyleRole::CommentInterior => Some("herb-comment".to_string()),
  }
}

fn split_lines(runs: &[StyledRun]) -> Vec<Vec<(&str, &StyleRole)>> {
  let mut lines: Vec<Vec<(&str, &StyleRole)>> = vec![Vec::new()];

  for run in runs {
    for (index, piece) in run.text.split('\n').enumerate() {
      if index > 0 {
        lines.push(Vec::new());
      }

      if !piece.is_empty() {
        lines.last_mut().expect("lines is never empty").push((piece, &run.role));
      }
    }
  }

  lines
}

fn piece_html(text: &str, role: &StyleRole) -> String {
  match class_for_role(role) {
    Some(class) => format!("<span class=\"{class}\">{}</span>", escape_html(text)),
    None => escape_html(text),
  }
}

fn line_content(line: &[(&str, &StyleRole)]) -> String {
  let mut content = String::new();

  for (text, role) in line {
    content.push_str(&piece_html(text, role));
  }

  content
}

fn is_linkable(url: &str) -> bool {
  let lower = url.to_lowercase();

  lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("file://")
}

fn linkify(text: &str, url: Option<&str>) -> String {
  match url {
    Some(url) if is_linkable(url) => format!("<a href=\"{}\" rel=\"noopener noreferrer\">{text}</a>", escape_html(url)),
    _ => text.to_string(),
  }
}

fn severity_label(severity: DiagnosticSeverity) -> String {
  format!("<span class=\"herb-severity-label herb-severity-{severity}\">{severity}</span>")
}

fn message_html(message: &str) -> String {
  replace_backticks(&escape_html(message), "<code>", "</code>")
}

fn code_html(code: Option<&str>, code_url: Option<&str>) -> String {
  let text = match code {
    Some(code) => escape_html(code),
    None => "-".to_string(),
  };

  linkify(&text, code_url)
}

struct HeaderData<'a> {
  severity: DiagnosticSeverity,
  message: &'a str,
  code: Option<&'a str>,
  code_url: Option<&'a str>,
  suffix: Option<&'a str>,
}

struct FileData<'a> {
  path: &'a str,
  line: usize,
  column: usize,
  url: Option<&'a str>,
}

struct BlockData<'a> {
  first_line: usize,
  runs: &'a [StyledRun],
  lines: &'a [LineInfo],
}

pub fn render_document_html(document: &Document, options: &HTMLSinkOptions) -> String {
  render_groups(document, options).join("\n")
}

pub fn render_document_fragments(document: &Document, options: &HTMLSinkOptions) -> Vec<String> {
  render_groups(document, options)
}

fn render_groups(document: &Document, options: &HTMLSinkOptions) -> Vec<String> {
  let mut results: Vec<String> = Vec::new();
  let mut index = 0;

  while index < document.nodes.len() {
    match &document.nodes[index] {
      Node::DiagnosticHeader {
        severity,
        message,
        code,
        code_url,
        suffix,
      } => {
        if let (Some(Node::FileHeader { path, line, column, url }), Some(Node::CodeBlock { first_line, runs, lines, .. })) =
          (document.nodes.get(index + 1), document.nodes.get(index + 2))
        {
          results.push(render_card(
            &HeaderData {
              severity: *severity,
              message,
              code: code.as_deref(),
              code_url: code_url.as_deref(),
              suffix: suffix.as_deref(),
            },
            &FileData {
              path,
              line: line.unwrap_or(0),
              column: column.unwrap_or(0),
              url: url.as_deref(),
            },
            &BlockData {
              first_line: *first_line,
              runs,
              lines,
            },
            options,
          ));

          index += 3;
        } else {
          index += 1;
        }
      }

      Node::FileHeader { path, .. } => match document.nodes.get(index + 1) {
        Some(Node::CodeBlock {
          kind: CodeBlockKind::AnnotatedListing,
          first_line,
          runs,
          lines,
        }) => {
          results.push(render_inline(
            Some(path),
            &BlockData {
              first_line: *first_line,
              runs,
              lines,
            },
            options,
          ));

          index += 2;
        }

        Some(Node::CodeBlock { first_line, runs, lines, .. }) => {
          results.push(render_listing(
            Some(path),
            &BlockData {
              first_line: *first_line,
              runs,
              lines,
            },
            options,
          ));

          index += 2;
        }

        Some(Node::DiffBlock {
          original_runs,
          modified_runs,
          hunks,
        }) => {
          results.push(render_diff(Some(path), original_runs, modified_runs, hunks, options));

          index += 2;
        }

        _ => index += 1,
      },

      Node::CodeBlock { kind, first_line, runs, lines } => {
        let block = BlockData {
          first_line: *first_line,
          runs,
          lines,
        };

        if *kind == CodeBlockKind::AnnotatedListing {
          results.push(render_inline(None, &block, options));
        } else {
          results.push(render_listing(None, &block, options));
        }

        index += 1;
      }

      Node::DiffBlock {
        original_runs,
        modified_runs,
        hunks,
      } => {
        results.push(render_diff(None, original_runs, modified_runs, hunks, options));

        index += 1;
      }

      Node::ProgressRule { index: rule_index, total } => {
        results.push(format!("<hr class=\"herb-progress-rule\" data-herb-progress=\"{rule_index}/{total}\">"));

        index += 1;
      }
    }
  }

  results
}

fn render_listing(path: Option<&str>, block: &BlockData<'_>, options: &HTMLSinkOptions) -> String {
  let pieces_by_line = split_lines(block.runs);

  let content_for = |info: &LineInfo| {
    pieces_by_line
      .get(info.number - block.first_line)
      .map(|line| line_content(line))
      .unwrap_or_default()
  };

  let Some(path) = path else {
    let line_spans: Vec<String> = block
      .lines
      .iter()
      .map(|info| format!("<span class=\"herb-line\">{}</span>", content_for(info)))
      .collect();

    return format!(
      "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
      escape_html(&options.theme_label),
      line_spans.join("\n")
    );
  };

  let has_focus = block
    .lines
    .iter()
    .any(|info| matches!(info.emphasis, LineEmphasis::Focus | LineEmphasis::Dimmed));

  if !has_focus && options.show_line_numbers {
    let line_spans: Vec<String> = block
      .lines
      .iter()
      .map(|info| format!("<span class=\"herb-line\" data-line=\"{}\">{}</span>", info.number, content_for(info)))
      .collect();

    return format!(
      "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<figcaption class=\"herb-file-header\">{}</figcaption>\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
      escape_html(&options.theme_label),
      escape_html(path),
      line_spans.join("\n")
    );
  }

  let line_spans: Vec<String> = block
    .lines
    .iter()
    .map(|info| {
      let emphasis_class = match info.emphasis {
        LineEmphasis::Focus => " herb-line-focus",
        LineEmphasis::Dimmed => " herb-line-dimmed",
        _ => "",
      };

      let data_line = if options.show_line_numbers {
        format!(" data-line=\"{}\"", info.number)
      } else {
        String::new()
      };

      format!("<span class=\"herb-line{emphasis_class}\"{data_line}>{}</span>", content_for(info))
    })
    .collect();

  let figcaption = if options.show_line_numbers {
    format!("<figcaption class=\"herb-file-header\">{}</figcaption>\n", escape_html(path))
  } else {
    String::new()
  };

  format!(
    "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n{figcaption}<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(&options.theme_label),
    line_spans.join("\n")
  )
}

fn severity_at(assignment: &[Option<DiagnosticSeverity>], column: usize) -> Option<DiagnosticSeverity> {
  assignment.get(column).copied().flatten()
}

fn marked_line_content(pieces: &[(&str, &StyleRole)], annotations: &[Annotation]) -> String {
  if annotations.is_empty() {
    return line_content(pieces);
  }

  let max_end = annotations.iter().map(|annotation| annotation.end).max().unwrap_or(0);
  let mut assignment: Vec<Option<DiagnosticSeverity>> = vec![None; max_end];

  for annotation in annotations {
    for slot in assignment.iter_mut().take(annotation.end).skip(annotation.start) {
      match slot {
        Some(existing) if annotation.severity.order() < existing.order() => *slot = Some(annotation.severity),
        None => *slot = Some(annotation.severity),
        _ => {}
      }
    }
  }

  let mut content = String::new();
  let mut column = 0;

  for (text, role) in pieces {
    let characters: Vec<char> = text.chars().collect();
    let mut start = 0;

    while start < characters.len() {
      let current = severity_at(&assignment, column + start);
      let mut end = start + 1;

      while end < characters.len() && severity_at(&assignment, column + end) == current {
        end += 1;
      }

      let sub_piece: String = characters[start..end].iter().collect();
      let rendered = piece_html(&sub_piece, role);

      match current {
        Some(severity) => content.push_str(&format!("<mark class=\"herb-marker herb-marker-{severity}\">{rendered}</mark>")),
        None => content.push_str(&rendered),
      }

      start = end;
    }

    column += characters.len();
  }

  content
}

fn render_annotated_line(info: &LineInfo, pieces: &[(&str, &StyleRole)], options: &HTMLSinkOptions) -> String {
  let mut class = String::from("herb-line");

  let marked_severity = match info.emphasis {
    LineEmphasis::Marked { severity } => {
      class.push_str(" herb-line-marked");

      Some(severity)
    }

    LineEmphasis::Dimmed => {
      class.push_str(" herb-line-dimmed");

      None
    }

    _ => None,
  };

  let mut attributes = format!("class=\"{class}\"");

  if options.show_line_numbers {
    attributes.push_str(&format!(" data-line=\"{}\"", info.number));
  }

  if let Some(severity) = marked_severity {
    attributes.push_str(&format!(" data-herb-severity=\"{severity}\""));
  }

  if options.markers == MarkerMode::HighlightApi && !info.annotations.is_empty() {
    let markers: Vec<(usize, usize, &str)> = info
      .annotations
      .iter()
      .map(|annotation| (annotation.start, annotation.end, annotation.severity.as_str()))
      .collect();

    let json = serde_json::to_string(&markers).expect("markers serialize");

    attributes.push_str(&format!(" data-herb-markers=\"{}\"", escape_html(&json)));
  }

  let content = match options.markers {
    MarkerMode::HighlightApi => line_content(pieces),
    MarkerMode::Spans => marked_line_content(pieces, &info.annotations),
  };

  let mut result = format!("<span {attributes}>{content}");

  for annotation in &info.annotations {
    if let Some(message) = &annotation.message {
      result.push_str(&format!(
        "<span class=\"herb-annotation-message\">{} {} <span class=\"herb-diagnostic-code\">({})</span></span>",
        severity_label(annotation.severity),
        message_html(&message.text),
        code_html(message.code.as_deref(), message.code_url.as_deref())
      ));
    }
  }

  result.push_str("</span>");

  result
}

fn annotated_line_spans(block: &BlockData<'_>, options: &HTMLSinkOptions) -> Vec<String> {
  let pieces_by_line = split_lines(block.runs);

  block
    .lines
    .iter()
    .map(|info| {
      let pieces = pieces_by_line.get(info.number - block.first_line).map(|line| line.as_slice()).unwrap_or(&[]);

      render_annotated_line(info, pieces, options)
    })
    .collect()
}

fn render_card(header: &HeaderData<'_>, file: &FileData<'_>, block: &BlockData<'_>, options: &HTMLSinkOptions) -> String {
  let suffix = match header.suffix {
    Some(suffix) => format!(" <span class=\"herb-diagnostic-suffix\">{}</span>", escape_html(suffix)),
    None => String::new(),
  };

  let header_html = format!(
    "<header class=\"herb-diagnostic-header\">{} <span class=\"herb-diagnostic-message\">{}</span> <span class=\"herb-diagnostic-code\">({})</span>{suffix}</header>",
    severity_label(header.severity),
    message_html(header.message),
    code_html(header.code, header.code_url)
  );

  let figcaption = if options.show_line_numbers {
    let location = format!("{}:{}:{}", escape_html(file.path), file.line, file.column);

    format!("<figcaption class=\"herb-file-header\">{}</figcaption>\n", linkify(&location, file.url))
  } else {
    String::new()
  };

  format!(
    "<figure class=\"herb-highlight herb-diagnostic\" data-herb-theme=\"{}\">\n{header_html}\n{figcaption}<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(&options.theme_label),
    annotated_line_spans(block, options).join("\n")
  )
}

fn render_inline(path: Option<&str>, block: &BlockData<'_>, options: &HTMLSinkOptions) -> String {
  let figcaption = match path {
    Some(path) if options.show_line_numbers => format!("<figcaption class=\"herb-file-header\">{}</figcaption>\n", escape_html(path)),
    _ => String::new(),
  };

  format!(
    "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n{figcaption}<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(&options.theme_label),
    annotated_line_spans(block, options).join("\n")
  )
}

const DIFF_SEPARATOR_ROW: &str = "<span class=\"herb-line herb-diff-hunk-separator\"></span>";

fn render_diff(path: Option<&str>, original_runs: &[StyledRun], modified_runs: &[StyledRun], hunks: &[DiffHunkInfo], options: &HTMLSinkOptions) -> String {
  let original_pieces = split_lines(original_runs);
  let modified_pieces = split_lines(modified_runs);

  let figcaption = match path {
    Some(path) if options.show_line_numbers => format!("<figcaption class=\"herb-file-header\">{}</figcaption>\n", escape_html(path)),
    _ => String::new(),
  };

  if options.diff_layout == DiffLayout::Split {
    return render_split_diff(&figcaption, &original_pieces, &modified_pieces, hunks, options);
  }

  let mut rows: Vec<String> = Vec::new();

  for (hunk_index, hunk) in hunks.iter().enumerate() {
    if hunk_index > 0 {
      rows.push(DIFF_SEPARATOR_ROW.to_string());
    }

    for row in &hunk.rows {
      rows.push(diff_row_span(row, &original_pieces, &modified_pieces, options));
    }
  }

  format!(
    "<figure class=\"herb-highlight herb-diff\" data-herb-theme=\"{}\">\n{figcaption}<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(&options.theme_label),
    rows.join("\n")
  )
}

fn render_split_diff(
  figcaption: &str,
  original_pieces: &[Vec<(&str, &StyleRole)>],
  modified_pieces: &[Vec<(&str, &StyleRole)>],
  hunks: &[DiffHunkInfo],
  options: &HTMLSinkOptions,
) -> String {
  let mut left: Vec<String> = Vec::new();
  let mut right: Vec<String> = Vec::new();

  for (hunk_index, hunk) in hunks.iter().enumerate() {
    if hunk_index > 0 {
      left.push(DIFF_SEPARATOR_ROW.to_string());
      right.push(DIFF_SEPARATOR_ROW.to_string());
    }

    for (left_index, right_index) in hunk.split_row_pairs() {
      left.push(split_diff_cell(hunk, left_index, original_pieces, modified_pieces, options));
      right.push(split_diff_cell(hunk, right_index, original_pieces, modified_pieces, options));
    }
  }

  format!(
    "<figure class=\"herb-highlight herb-diff herb-diff-split\" data-herb-theme=\"{}\">\n{figcaption}<div class=\"herb-diff-columns\">\n<pre class=\"herb-code herb-diff-column herb-diff-column-old\"><code>{}</code></pre>\n<pre class=\"herb-code herb-diff-column herb-diff-column-new\"><code>{}</code></pre>\n</div>\n</figure>",
    escape_html(&options.theme_label),
    left.join("\n"),
    right.join("\n")
  )
}

fn split_diff_cell(
  hunk: &DiffHunkInfo,
  index: Option<usize>,
  original_pieces: &[Vec<(&str, &StyleRole)>],
  modified_pieces: &[Vec<(&str, &StyleRole)>],
  options: &HTMLSinkOptions,
) -> String {
  match index {
    Some(index) => diff_row_span(&hunk.rows[index], original_pieces, modified_pieces, options),
    None => "<span class=\"herb-line herb-diff-empty\"></span>".to_string(),
  }
}

fn diff_row_span(
  row: &DiffRowInfo,
  original_pieces: &[Vec<(&str, &StyleRole)>],
  modified_pieces: &[Vec<(&str, &StyleRole)>],
  options: &HTMLSinkOptions,
) -> String {
  let content = diff_row_content(row, original_pieces, modified_pieces);

  let mut attributes = String::new();

  let class = match row.kind {
    DiffLineType::Context => {
      if options.show_line_numbers {
        attributes.push_str(&format!(" data-old-line=\"{}\"", row.old_line.expect("context rows carry an old line number")));
        attributes.push_str(&format!(" data-new-line=\"{}\"", row.new_line.expect("context rows carry a new line number")));
      }

      "herb-diff-context"
    }

    DiffLineType::Removed => {
      if options.show_line_numbers {
        attributes.push_str(&format!(" data-old-line=\"{}\"", row.old_line.expect("removed rows carry an old line number")));
      }

      "herb-diff-removed"
    }

    DiffLineType::Added => {
      if options.show_line_numbers {
        attributes.push_str(&format!(" data-new-line=\"{}\"", row.new_line.expect("added rows carry a new line number")));
      }

      "herb-diff-added"
    }
  };

  format!("<span class=\"herb-line {class}\"{attributes}>{content}</span>")
}

fn diff_row_content(row: &DiffRowInfo, original_pieces: &[Vec<(&str, &StyleRole)>], modified_pieces: &[Vec<(&str, &StyleRole)>]) -> String {
  let pieces = if row.kind == DiffLineType::Added {
    modified_pieces.get(row.new_line.expect("added lines carry a new line number") - 1)
  } else {
    original_pieces.get(row.old_line.expect("context and removed lines carry an old line number") - 1)
  }
  .map(|line| line.as_slice())
  .unwrap_or(&[]);

  if row.inline_ranges.is_empty() {
    return line_content(pieces);
  }

  let mark_class = if row.kind == DiffLineType::Added {
    "herb-diff-inline-added"
  } else {
    "herb-diff-inline-removed"
  };

  inline_marked_content(pieces, &row.inline_ranges, mark_class)
}

fn in_inline_range(assignment: &[bool], column: usize) -> bool {
  assignment.get(column).copied().unwrap_or(false)
}

fn inline_marked_content(pieces: &[(&str, &StyleRole)], ranges: &[InlineRangeInfo], mark_class: &str) -> String {
  let max_end = ranges.iter().map(|range| range.end).max().unwrap_or(0);
  let mut assignment: Vec<bool> = vec![false; max_end];

  for range in ranges {
    for slot in assignment.iter_mut().take(range.end).skip(range.start) {
      *slot = true;
    }
  }

  let mut content = String::new();
  let mut column = 0;

  for (text, role) in pieces {
    let characters: Vec<char> = text.chars().collect();
    let mut start = 0;

    while start < characters.len() {
      let current = in_inline_range(&assignment, column + start);
      let mut end = start + 1;

      while end < characters.len() && in_inline_range(&assignment, column + end) == current {
        end += 1;
      }

      let sub_piece: String = characters[start..end].iter().collect();
      let rendered = piece_html(&sub_piece, role);

      if current {
        content.push_str(&format!("<mark class=\"{mark_class}\">{rendered}</mark>"));
      } else {
        content.push_str(&rendered);
      }

      start = end;
    }

    column += characters.len();
  }

  content
}

pub fn wrap_document_html(fragments: &str, stylesheet: &str, include_hydration: bool) -> String {
  let script = if include_hydration {
    format!("<script>\n{HYDRATION_SCRIPT}</script>\n")
  } else {
    String::new()
  };

  format!(
    "<!doctype html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>herb-highlight</title>\n<style>\n{stylesheet}</style>\n</head>\n<body>\n{fragments}\n{script}</body>\n</html>"
  )
}

fn listing_document(nodes: Vec<Node>) -> Document {
  Document { version: 1, nodes }
}

fn listing_lines(count: usize, emphasis_for: impl Fn(usize) -> LineEmphasis) -> Vec<LineInfo> {
  (1..=count)
    .map(|number| LineInfo {
      number,
      emphasis: emphasis_for(number),
      annotations: Vec::new(),
    })
    .collect()
}

pub fn render_file_html(runs: &[StyledRun], path: &str, theme_label: &str) -> String {
  let line_count = split_lines(runs).len();

  let document = listing_document(vec![
    Node::FileHeader {
      path: path.to_string(),
      line: None,
      column: None,
      url: None,
    },
    Node::CodeBlock {
      kind: CodeBlockKind::Listing,
      first_line: 1,
      runs: runs.to_vec(),
      lines: listing_lines(line_count, |_| LineEmphasis::Normal),
    },
  ]);

  render_document_html(
    &document,
    &HTMLSinkOptions {
      theme_label: theme_label.to_string(),
      show_line_numbers: true,
      markers: MarkerMode::Spans,
      ..Default::default()
    },
  )
}

pub fn render_plain_html(runs: &[StyledRun], theme_label: &str) -> String {
  let line_count = split_lines(runs).len();

  let document = listing_document(vec![Node::CodeBlock {
    kind: CodeBlockKind::Listing,
    first_line: 1,
    runs: runs.to_vec(),
    lines: listing_lines(line_count, |_| LineEmphasis::Normal),
  }]);

  render_document_html(
    &document,
    &HTMLSinkOptions {
      theme_label: theme_label.to_string(),
      show_line_numbers: false,
      markers: MarkerMode::Spans,
      ..Default::default()
    },
  )
}

pub fn render_focus_html(runs: &[StyledRun], path: &str, focus_line: usize, context_lines: usize, show_line_numbers: bool, theme_label: &str) -> String {
  let line_count = split_lines(runs).len();
  let start_line = 1.max(focus_line.saturating_sub(context_lines));
  let end_line = line_count.min(focus_line + context_lines);

  let lines = (start_line..=end_line)
    .map(|number| LineInfo {
      number,
      emphasis: if number == focus_line { LineEmphasis::Focus } else { LineEmphasis::Dimmed },
      annotations: Vec::new(),
    })
    .collect();

  let document = listing_document(vec![
    Node::FileHeader {
      path: path.to_string(),
      line: None,
      column: None,
      url: None,
    },
    Node::CodeBlock {
      kind: CodeBlockKind::Listing,
      first_line: 1,
      runs: runs.to_vec(),
      lines,
    },
  ]);

  render_document_html(
    &document,
    &HTMLSinkOptions {
      theme_label: theme_label.to_string(),
      show_line_numbers,
      markers: MarkerMode::Spans,
      ..Default::default()
    },
  )
}
