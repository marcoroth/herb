use std::fmt;

use serde::Serialize;

use crate::html_schema::queries::HtmlSchema;
use crate::html_schema::registry::HTML_ELEMENTS;
use crate::html_schema::types::{ContentModel, ElementScope};
use crate::shape::{Shape, ShapeAttribute, TagName};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
  Error,
  Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
  pub severity: DiagnosticSeverity,
  pub message: String,
  pub path: Vec<String>,
}

impl fmt::Display for Diagnostic {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    let label = match self.severity {
      DiagnosticSeverity::Error => "error",
      DiagnosticSeverity::Warning => "warning",
    };

    let path_string = if self.path.is_empty() { "(root)".to_string() } else { self.path.join(" > ") };

    write!(formatter, "{}: {}\n  at: {}", label, self.message, path_string)
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DocumentSection {
  Unknown,
  Head,
  Body,
}

struct ValidateContext {
  path: Vec<String>,
  parent_content_model: Option<ContentModel>,
  parent_tag: Option<String>,
  section: DocumentSection,
}

pub fn validate(shape: &Shape) -> Vec<Diagnostic> {
  let mut diagnostics = Vec::new();

  let mut context = ValidateContext {
    path: Vec::new(),
    parent_content_model: None,
    parent_tag: None,
    section: DocumentSection::Unknown,
  };

  validate_shape(shape, &mut context, &mut diagnostics);

  diagnostics
}

fn validate_shape(shape: &Shape, context: &mut ValidateContext, diagnostics: &mut Vec<Diagnostic>) {
  match shape {
    Shape::Element(element) => validate_element(element, context, diagnostics),

    Shape::Sequence(items) => {
      for item in items {
        validate_shape(item, context, diagnostics);
      }
    }

    Shape::Optional(inner) => validate_shape(inner, context, diagnostics),
    Shape::Repeated(inner) => validate_shape(inner, context, diagnostics),

    Shape::Union(variants) => {
      for variant in variants {
        validate_shape(variant, context, diagnostics);
      }
    }

    _ => {}
  }
}

fn validate_element(element: &crate::shape::ElementShape, context: &mut ValidateContext, diagnostics: &mut Vec<Diagnostic>) {
  let tag_name = match &element.tag {
    TagName::Static(name) => name.clone(),
    TagName::Dynamic => return,
  };

  let lowercase_tag = tag_name.to_lowercase();
  context.path.push(lowercase_tag.clone());

  let element_definition = HTML_ELEMENTS.get(lowercase_tag.as_str());

  if let Some(definition) = element_definition {
    if definition.content_model == ContentModel::Empty && !element.children.is_empty() {
      diagnostics.push(Diagnostic {
        severity: DiagnosticSeverity::Error,
        message: format!("<{}> is a void element and cannot have children", lowercase_tag),
        path: context.path.clone(),
      });
    }
  }

  if let Some(ref parent_model) = context.parent_content_model {
    check_content_model(&lowercase_tag, parent_model, context, diagnostics);
  }

  if let Some(definition) = element_definition {
    check_scope(definition.scope, &lowercase_tag, context, diagnostics);
  }

  if let Some(definition) = element_definition {
    check_required_attributes(&lowercase_tag, &definition.required_attributes, &element.attributes, context, diagnostics);
  }

  let previous_section = context.section;

  if lowercase_tag == "head" {
    context.section = DocumentSection::Head;
  } else if lowercase_tag == "body" {
    context.section = DocumentSection::Body;
  }

  let previous_model = context.parent_content_model.take();
  let previous_parent = context.parent_tag.take();
  context.parent_content_model = element_definition.map(|definition| definition.content_model.clone());
  context.parent_tag = Some(lowercase_tag.clone());

  for child in &element.children {
    validate_shape(child, context, diagnostics);
  }

  context.parent_content_model = previous_model;
  context.parent_tag = previous_parent;
  context.section = previous_section;
  context.path.pop();
}

fn check_content_model(child_tag: &str, parent_model: &ContentModel, context: &ValidateContext, diagnostics: &mut Vec<Diagnostic>) {
  let parent_name = context.parent_tag.as_deref().unwrap_or("(unknown)");

  match parent_model {
    ContentModel::Phrasing => {
      if HtmlSchema::is_block_element(child_tag) {
        diagnostics.push(Diagnostic {
          severity: DiagnosticSeverity::Error,
          message: format!("<{}> cannot contain block element <{}>", parent_name, child_tag),
          path: context.path.clone(),
        });
      }
    }

    ContentModel::Empty => {
      diagnostics.push(Diagnostic {
        severity: DiagnosticSeverity::Error,
        message: format!("<{}> is a void element and cannot contain <{}>", parent_name, child_tag),
        path: context.path.clone(),
      });
    }

    ContentModel::SpecificChildren(allowed) => {
      if !allowed.contains(&child_tag) {
        diagnostics.push(Diagnostic {
          severity: DiagnosticSeverity::Error,
          message: format!("<{}> cannot contain <{}> (expected: {})", parent_name, child_tag, allowed.join(", ")),
          path: context.path.clone(),
        });
      }
    }

    _ => {}
  }
}

fn check_scope(scope: ElementScope, tag_name: &str, context: &ValidateContext, diagnostics: &mut Vec<Diagnostic>) {
  match scope {
    ElementScope::HeadOnly => {
      if context.section == DocumentSection::Body {
        diagnostics.push(Diagnostic {
          severity: DiagnosticSeverity::Error,
          message: format!("<{}> is only valid inside <head>, but found inside <body>", tag_name),
          path: context.path.clone(),
        });
      }
    }

    ElementScope::BodyOnly => {
      if context.section == DocumentSection::Head {
        diagnostics.push(Diagnostic {
          severity: DiagnosticSeverity::Error,
          message: format!("<{}> is only valid inside <body>, but found inside <head>", tag_name),
          path: context.path.clone(),
        });
      }
    }

    _ => {}
  }
}

fn check_required_attributes(
  tag_name: &str,
  required_attributes: &[&str],
  attributes: &[ShapeAttribute],
  context: &ValidateContext,
  diagnostics: &mut Vec<Diagnostic>,
) {
  if required_attributes.is_empty() {
    return;
  }

  let has_dynamic_name = attributes.iter().any(|attribute| matches!(attribute, ShapeAttribute::DynamicName));

  if has_dynamic_name {
    return;
  }

  let static_names: Vec<&str> = attributes
    .iter()
    .filter_map(|attribute| match attribute {
      ShapeAttribute::Static { name, .. } => Some(name.as_str()),
      ShapeAttribute::Optional { name, .. } => Some(name.as_str()),
      ShapeAttribute::DynamicName => None,
    })
    .collect();

  for &required_attribute in required_attributes {
    if !static_names.contains(&required_attribute) {
      diagnostics.push(Diagnostic {
        severity: DiagnosticSeverity::Warning,
        message: format!("<{}> is missing required attribute: {}", tag_name, required_attribute),
        path: context.path.clone(),
      });
    }
  }
}
