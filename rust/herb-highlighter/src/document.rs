use serde::ser::SerializeMap;
use serde::{Serialize, Serializer};

use crate::diagnostic::DiagnosticSeverity;
use crate::diff_computer::DiffLineType;

#[derive(Debug, Clone, PartialEq)]
pub enum StyleRole {
  Plain,
  Token(String),
  RubyKeyword,
  TagName,
  AttributeName,
  AttributeValue,
  CommentInterior,
}

impl StyleRole {
  pub fn kind(&self) -> &'static str {
    match self {
      StyleRole::Plain => "Plain",
      StyleRole::Token(_) => "Token",
      StyleRole::RubyKeyword => "RubyKeyword",
      StyleRole::TagName => "TagName",
      StyleRole::AttributeName => "AttributeName",
      StyleRole::AttributeValue => "AttributeValue",
      StyleRole::CommentInterior => "CommentInterior",
    }
  }
}

impl Serialize for StyleRole {
  fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
    let mut map = serializer.serialize_map(None)?;

    map.serialize_entry("kind", self.kind())?;

    if let StyleRole::Token(token_type) = self {
      map.serialize_entry("tokenType", token_type)?;
    }

    map.end()
  }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StyledRun {
  pub text: String,
  pub role: StyleRole,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Document {
  pub version: u32,
  pub nodes: Vec<Node>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type")]
pub enum Node {
  FileHeader {
    path: String,
    line: Option<usize>,
    column: Option<usize>,
    url: Option<String>,
  },

  DiagnosticHeader {
    severity: DiagnosticSeverity,
    message: String,
    code: Option<String>,
    #[serde(rename = "codeUrl")]
    code_url: Option<String>,
    suffix: Option<String>,
  },

  CodeBlock {
    kind: CodeBlockKind,
    #[serde(rename = "firstLine")]
    first_line: usize,
    runs: Vec<StyledRun>,
    lines: Vec<LineInfo>,
  },

  DiffBlock {
    #[serde(rename = "originalRuns")]
    original_runs: Vec<StyledRun>,
    #[serde(rename = "modifiedRuns")]
    modified_runs: Vec<StyledRun>,
    hunks: Vec<DiffHunkInfo>,
  },

  ProgressRule {
    index: usize,
    total: usize,
  },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DiffHunkInfo {
  pub rows: Vec<DiffRowInfo>,
}

impl DiffHunkInfo {
  pub fn split_row_pairs(&self) -> Vec<(Option<usize>, Option<usize>)> {
    let mut pairs: Vec<(Option<usize>, Option<usize>)> = Vec::new();

    let mut index = 0;

    while index < self.rows.len() {
      if self.rows[index].kind == DiffLineType::Context {
        pairs.push((Some(index), Some(index)));
        index += 1;

        continue;
      }

      let mut removed: Vec<usize> = Vec::new();

      while index < self.rows.len() && self.rows[index].kind == DiffLineType::Removed {
        removed.push(index);
        index += 1;
      }

      let mut added: Vec<usize> = Vec::new();

      while index < self.rows.len() && self.rows[index].kind == DiffLineType::Added {
        added.push(index);
        index += 1;
      }

      for row in 0..removed.len().max(added.len()) {
        pairs.push((removed.get(row).copied(), added.get(row).copied()));
      }
    }

    pairs
  }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DiffRowInfo {
  pub kind: DiffLineType,
  pub content: String,
  #[serde(rename = "oldLine")]
  pub old_line: Option<usize>,
  #[serde(rename = "newLine")]
  pub new_line: Option<usize>,
  #[serde(rename = "inlineRanges")]
  pub inline_ranges: Vec<InlineRangeInfo>,
  pub collapse: Option<CollapseInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct InlineRangeInfo {
  pub start: usize,
  pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CollapseInfo {
  pub start: usize,
  #[serde(rename = "removedEnd")]
  pub removed_end: usize,
  #[serde(rename = "addedEnd")]
  pub added_end: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum CodeBlockKind {
  Listing,
  AnnotatedListing,
  Excerpt,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LineInfo {
  pub number: usize,
  pub emphasis: LineEmphasis,
  pub annotations: Vec<Annotation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind")]
pub enum LineEmphasis {
  Normal,
  Dimmed,
  Focus,
  Marked { severity: DiagnosticSeverity },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Annotation {
  pub start: usize,
  pub end: usize,
  pub severity: DiagnosticSeverity,
  pub message: Option<AnnotationMessage>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AnnotationMessage {
  pub text: String,
  pub code: Option<String>,
  #[serde(rename = "codeUrl")]
  pub code_url: Option<String>,
}
