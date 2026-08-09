use serde::ser::SerializeMap;
use serde::{Serialize, Serializer};

use crate::diagnostic::DiagnosticSeverity;

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

  ProgressRule {
    index: usize,
    total: usize,
  },
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
