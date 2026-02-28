use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ElementCategory {
  Void,
  Inline,
  Block,
  Metadata,
  Sectioning,
  Heading,
  Interactive,
  FormAssociated,
  Embedded,
  Svg,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ElementScope {
  DocumentRoot,
  HtmlOnly,
  HeadOnly,
  BodyOnly,
  HeadOrBody,
  Anywhere,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ContentModel {
  Empty,
  Flow,
  Phrasing,
  SpecificChildren(Vec<&'static str>),
  Transparent,
  RawText,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ElementDef {
  pub tag_name: &'static str,
  pub categories: Vec<ElementCategory>,
  pub scope: ElementScope,
  pub content_model: ContentModel,
  pub required_attributes: Vec<&'static str>,
  pub supports_disabled: bool,
}
