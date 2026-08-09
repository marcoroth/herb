use std::collections::HashMap;

use crate::diagnostic::{Diagnostic, DiagnosticSeverity, DIAGNOSTIC_SEVERITIES};
use crate::diagnostic_markers::{compute_diagnostic_markers, DiagnosticMarker};
use crate::diff_computer::{compute_diff_hunks, compute_inline_ranges, DiffHunk, DiffLineType, InlineRange};
use crate::document::{
  Annotation, AnnotationMessage, CodeBlockKind, CollapseInfo, DiffHunkInfo, DiffRowInfo, Document, InlineRangeInfo, LineEmphasis, LineInfo, Node,
};
use crate::highlighter::{FileUrlBuilder, SuffixBuilder};
use crate::inline_diagnostic_renderer::CodeUrlBuilder;
use crate::syntax_renderer::SyntaxRenderer;

pub struct CardOptions {
  pub context_lines: usize,
  pub optimize_highlighting: bool,
  pub code_url: Option<String>,
  pub file_url: Option<String>,
  pub suffix: Option<String>,
}

pub struct DiffDocumentOptions {
  pub context_lines: usize,
  pub highlight_inline_changes: bool,
}

impl Default for DiffDocumentOptions {
  fn default() -> Self {
    Self {
      context_lines: 2,
      highlight_inline_changes: true,
    }
  }
}

pub struct SplitOptions<'a> {
  pub context_lines: usize,
  pub optimize_highlighting: bool,
  pub code_url_builder: Option<CodeUrlBuilder<'a>>,
  pub file_url_builder: Option<FileUrlBuilder<'a>>,
  pub suffix_builder: Option<SuffixBuilder<'a>>,
}

pub struct DocumentBuilder<'a> {
  syntax_renderer: &'a SyntaxRenderer,
}

impl<'a> DocumentBuilder<'a> {
  pub fn new(syntax_renderer: &'a SyntaxRenderer) -> Self {
    Self { syntax_renderer }
  }

  fn file_header(path: &str) -> Node {
    Node::FileHeader {
      path: path.to_string(),
      line: None,
      column: None,
      url: None,
    }
  }

  fn listing_block(&self, content: &str) -> Node {
    let line_count = content.split('\n').count();

    Node::CodeBlock {
      kind: CodeBlockKind::Listing,
      first_line: 1,
      runs: self.syntax_renderer.highlight_runs(content),
      lines: (1..=line_count)
        .map(|number| LineInfo {
          number,
          emphasis: LineEmphasis::Normal,
          annotations: Vec::new(),
        })
        .collect(),
    }
  }

  pub fn build_file(&self, path: &str, content: &str) -> Document {
    Document {
      version: 1,
      nodes: vec![Self::file_header(path), self.listing_block(content)],
    }
  }

  pub fn build_plain(&self, content: &str) -> Document {
    Document {
      version: 1,
      nodes: vec![self.listing_block(content)],
    }
  }

  pub fn build_focus(&self, path: &str, content: &str, focus_line: usize, context_lines: usize) -> Document {
    let line_count = content.split('\n').count();

    let start_line = 1.max(focus_line.saturating_sub(context_lines));
    let end_line = line_count.min(focus_line + context_lines);

    Document {
      version: 1,
      nodes: vec![
        Self::file_header(path),
        Node::CodeBlock {
          kind: CodeBlockKind::Listing,
          first_line: 1,
          runs: self.syntax_renderer.highlight_runs(content),
          lines: (start_line..=end_line)
            .map(|number| LineInfo {
              number,
              emphasis: if number == focus_line { LineEmphasis::Focus } else { LineEmphasis::Dimmed },
              annotations: Vec::new(),
            })
            .collect(),
        },
      ],
    }
  }

  pub fn build_inline(&self, path: &str, content: &str, diagnostics: &[Diagnostic], code_url_builder: Option<CodeUrlBuilder<'_>>) -> Document {
    let content_lines: Vec<&str> = content.split('\n').collect();

    let mut annotations_by_line: HashMap<usize, Vec<Annotation>> = HashMap::new();

    for diagnostic in diagnostics {
      let markers = compute_diagnostic_markers(&diagnostic.location, &content_lines);
      let last_index = markers.len() - 1;

      for (index, marker) in markers.into_iter().enumerate() {
        let message = (index == last_index).then(|| AnnotationMessage {
          text: diagnostic.message.clone(),
          code: diagnostic.code.clone(),
          code_url: match (code_url_builder, &diagnostic.code) {
            (Some(builder), Some(code)) => Some(builder(code)),
            _ => None,
          },
        });

        annotations_by_line.entry(marker.line).or_default().push(Annotation {
          start: marker.start,
          end: marker.end,
          severity: diagnostic.severity,
          message,
        });
      }
    }

    for annotations in annotations_by_line.values_mut() {
      annotations.sort_by_key(|annotation| annotation.severity.order());
    }

    let lines = (1..=content_lines.len())
      .map(|number| {
        let annotations = annotations_by_line.remove(&number).unwrap_or_default();

        let emphasis = match highest_severity(&annotations) {
          Some(severity) => LineEmphasis::Marked { severity },
          None => LineEmphasis::Normal,
        };

        LineInfo { number, emphasis, annotations }
      })
      .collect();

    Document {
      version: 1,
      nodes: vec![
        Self::file_header(path),
        Node::CodeBlock {
          kind: CodeBlockKind::AnnotatedListing,
          first_line: 1,
          runs: self.syntax_renderer.highlight_runs(content),
          lines,
        },
      ],
    }
  }

  pub fn build_card(&self, path: &str, diagnostic: &Diagnostic, content: &str, options: &CardOptions) -> Document {
    let original_lines: Vec<&str> = content.split('\n').collect();

    let markers = compute_diagnostic_markers(&diagnostic.location, &original_lines);
    let markers_by_line: HashMap<usize, DiagnosticMarker> = markers.iter().map(|marker| (marker.line, *marker)).collect();

    let first_marked_line = markers[0].line;
    let last_marked_line = markers[markers.len() - 1].line;

    let start_line = 1.max(first_marked_line.saturating_sub(options.context_lines));
    let end_line = original_lines.len().min(last_marked_line + options.context_lines);

    let (runs, first_line) = if options.optimize_highlighting {
      let mut relevant_lines: Vec<&str> = Vec::new();

      for number in start_line..=end_line {
        relevant_lines.push(original_lines.get(number - 1).copied().unwrap_or(""));
      }

      (self.syntax_renderer.highlight_runs(&relevant_lines.join("\n")), start_line)
    } else {
      (self.syntax_renderer.highlight_runs(content), 1)
    };

    let lines = (start_line..=end_line)
      .map(|number| match markers_by_line.get(&number) {
        Some(marker) => LineInfo {
          number,
          emphasis: LineEmphasis::Marked { severity: diagnostic.severity },
          annotations: vec![Annotation {
            start: marker.start,
            end: marker.end,
            severity: diagnostic.severity,
            message: None,
          }],
        },

        None => LineInfo {
          number,
          emphasis: LineEmphasis::Dimmed,
          annotations: Vec::new(),
        },
      })
      .collect();

    Document {
      version: 1,
      nodes: vec![
        Node::DiagnosticHeader {
          severity: diagnostic.severity,
          message: diagnostic.message.clone(),
          code: diagnostic.code.clone(),
          code_url: options.code_url.clone(),
          suffix: options.suffix.clone(),
        },
        Node::FileHeader {
          path: path.to_string(),
          line: Some(diagnostic.location.start.line),
          column: Some(diagnostic.location.start.column),
          url: options.file_url.clone(),
        },
        Node::CodeBlock {
          kind: CodeBlockKind::Excerpt,
          first_line,
          runs,
          lines,
        },
      ],
    }
  }

  pub fn build_split(&self, path: &str, content: &str, diagnostics: &[Diagnostic], options: &SplitOptions<'_>) -> Document {
    let total = diagnostics.len();
    let mut nodes: Vec<Node> = Vec::new();

    for (index, diagnostic) in diagnostics.iter().enumerate() {
      let code_url = match (options.code_url_builder, &diagnostic.code) {
        (Some(builder), Some(code)) => Some(builder(code)),
        _ => None,
      };

      let file_url = options.file_url_builder.map(|builder| builder(path, diagnostic));
      let suffix = options.suffix_builder.and_then(|builder| builder(diagnostic));

      let card = self.build_card(
        path,
        diagnostic,
        content,
        &CardOptions {
          context_lines: options.context_lines,
          optimize_highlighting: options.optimize_highlighting,
          code_url,
          file_url,
          suffix,
        },
      );

      nodes.extend(card.nodes);

      if index < total - 1 {
        nodes.push(Node::ProgressRule { index: index + 1, total });
      }
    }

    Document { version: 1, nodes }
  }

  pub fn build_diff(&self, path: &str, original: &str, modified: &str, options: &DiffDocumentOptions) -> Document {
    let hunks = compute_diff_hunks(original, modified, options.context_lines);

    if hunks.is_empty() {
      return Document { version: 1, nodes: Vec::new() };
    }

    self.diff_document(path, &hunks, original, modified, options)
  }

  pub fn build_diff_from_hunks(&self, path: &str, hunks: &[DiffHunk], options: &DiffDocumentOptions) -> Document {
    if hunks.is_empty() {
      return Document { version: 1, nodes: Vec::new() };
    }

    let mut original_source: Vec<String> = Vec::new();
    let mut modified_source: Vec<String> = Vec::new();

    for hunk in hunks {
      for line in &hunk.lines {
        if let Some(number) = line.old_line_number {
          fill(&mut original_source, number - 1, line.content.clone());
        }

        if let Some(number) = line.new_line_number {
          fill(&mut modified_source, number - 1, line.content.clone());
        }
      }
    }

    self.diff_document(path, hunks, &original_source.join("\n"), &modified_source.join("\n"), options)
  }

  fn diff_document(&self, path: &str, hunks: &[DiffHunk], original: &str, modified: &str, options: &DiffDocumentOptions) -> Document {
    let mut nodes: Vec<Node> = Vec::new();

    if !path.is_empty() {
      nodes.push(Self::file_header(path));
    }

    nodes.push(Node::DiffBlock {
      original_runs: self.syntax_renderer.highlight_runs(original),
      modified_runs: self.syntax_renderer.highlight_runs(modified),
      hunks: hunks.iter().map(|hunk| hunk_info(hunk, options)).collect(),
    });

    Document { version: 1, nodes }
  }
}

fn hunk_info(hunk: &DiffHunk, options: &DiffDocumentOptions) -> DiffHunkInfo {
  let inline_ranges = if options.highlight_inline_changes {
    inline_ranges_for(hunk)
  } else {
    HashMap::new()
  };

  let collapses = collapse_candidates(hunk, &inline_ranges);

  DiffHunkInfo {
    rows: hunk
      .lines
      .iter()
      .enumerate()
      .map(|(index, line)| DiffRowInfo {
        kind: line.line_type,
        content: line.content.clone(),
        old_line: line.old_line_number,
        new_line: line.new_line_number,
        inline_ranges: inline_ranges
          .get(&index)
          .map(|ranges| {
            ranges
              .iter()
              .map(|range| InlineRangeInfo {
                start: range.start,
                end: range.end,
              })
              .collect()
          })
          .unwrap_or_default(),
        collapse: collapses.get(&index).cloned(),
      })
      .collect(),
  }
}

fn inline_ranges_for(hunk: &DiffHunk) -> HashMap<usize, Vec<InlineRange>> {
  let mut ranges: HashMap<usize, Vec<InlineRange>> = HashMap::new();

  let mut index = 0;

  while index < hunk.lines.len() {
    if hunk.lines[index].line_type != DiffLineType::Removed {
      index += 1;

      continue;
    }

    let mut removed: Vec<usize> = Vec::new();

    while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Removed {
      removed.push(index);
      index += 1;
    }

    let mut added: Vec<usize> = Vec::new();

    while index < hunk.lines.len() && hunk.lines[index].line_type == DiffLineType::Added {
      added.push(index);
      index += 1;
    }

    if removed.len() != added.len() {
      continue;
    }

    for pair in 0..removed.len() {
      let inline = compute_inline_ranges(&hunk.lines[removed[pair]].content, &hunk.lines[added[pair]].content);

      if !inline.removed.is_empty() || !inline.added.is_empty() {
        ranges.insert(removed[pair], inline.removed);
        ranges.insert(added[pair], inline.added);
      }
    }
  }

  ranges
}

fn collapse_candidates(hunk: &DiffHunk, inline_ranges: &HashMap<usize, Vec<InlineRange>>) -> HashMap<usize, CollapseInfo> {
  let mut candidates: HashMap<usize, CollapseInfo> = HashMap::new();

  if hunk.lines.is_empty() {
    return candidates;
  }

  let mut index = 0;

  while index < hunk.lines.len() - 1 {
    let removed = &hunk.lines[index];
    let added = &hunk.lines[index + 1];

    if removed.line_type != DiffLineType::Removed || added.line_type != DiffLineType::Added {
      index += 1;

      continue;
    }

    if hunk.lines.get(index + 2).map(|line| line.line_type) == Some(DiffLineType::Added) {
      index += 1;

      continue;
    }

    if index > 0 && hunk.lines[index - 1].line_type == DiffLineType::Removed {
      index += 1;

      continue;
    }

    let (Some(removed_ranges), Some(added_ranges)) = (inline_ranges.get(&index), inline_ranges.get(&(index + 1))) else {
      index += 1;

      continue;
    };

    if removed_ranges.len() > 1 || added_ranges.len() > 1 {
      index += 1;

      continue;
    }

    if removed_ranges.is_empty() && added_ranges.is_empty() {
      index += 1;

      continue;
    }

    let start = removed_ranges
      .first()
      .map(|range| range.start)
      .unwrap_or(usize::MAX)
      .min(added_ranges.first().map(|range| range.start).unwrap_or(usize::MAX));

    let removed_end = removed_ranges.first().map(|range| range.end).unwrap_or(start);
    let added_end = added_ranges.first().map(|range| range.end).unwrap_or(start);

    candidates.insert(index, CollapseInfo { start, removed_end, added_end });

    index += 2;
  }

  candidates
}

fn fill(lines: &mut Vec<String>, index: usize, content: String) {
  while lines.len() <= index {
    lines.push(String::new());
  }

  lines[index] = content;
}

fn highest_severity(annotations: &[Annotation]) -> Option<DiagnosticSeverity> {
  if annotations.is_empty() {
    return None;
  }

  for severity in DIAGNOSTIC_SEVERITIES {
    if annotations.iter().any(|annotation| annotation.severity == severity) {
      return Some(severity);
    }
  }

  Some(DiagnosticSeverity::Warning)
}
