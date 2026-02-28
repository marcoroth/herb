use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", content = "value")]
pub enum Shape {
  Element(ElementShape),
  Text,
  Comment,
  Doctype,
  Optional(Box<Shape>),
  Union(Vec<Shape>),
  Repeated(Box<Shape>),
  Sequence(Vec<Shape>),
  PartialRef(String),
  Dynamic,
  Empty,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ElementShape {
  pub tag: TagName,
  pub attributes: Vec<ShapeAttribute>,
  pub children: Vec<Shape>,
  pub is_void: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", content = "value")]
pub enum TagName {
  Static(String),
  Dynamic,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type")]
pub enum ShapeAttribute {
  Static { name: String, value: AttributeValue },
  Optional { name: String, value: AttributeValue },
  DynamicName,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", content = "value")]
pub enum AttributeValue {
  Static(String),
  Dynamic,
  Mixed,
  Boolean,
}
