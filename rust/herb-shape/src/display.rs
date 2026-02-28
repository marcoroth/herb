use std::fmt;

use crate::shape::*;

impl fmt::Display for Shape {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Shape::Element(element) => write!(formatter, "{}", element),
      Shape::Text => write!(formatter, "Text"),
      Shape::Comment => write!(formatter, "Comment"),
      Shape::Doctype => write!(formatter, "Doctype"),
      Shape::Optional(inner) => write!(formatter, "Optional<{}>", inner),

      Shape::Union(variants) => {
        write!(formatter, "Union<")?;

        for (index, variant) in variants.iter().enumerate() {
          if index > 0 {
            write!(formatter, " | ")?;
          }

          write!(formatter, "{}", variant)?;
        }

        write!(formatter, ">")
      }

      Shape::Repeated(inner) => write!(formatter, "Repeated<{}>", inner),

      Shape::Sequence(items) => {
        write!(formatter, "[")?;

        for (index, item) in items.iter().enumerate() {
          if index > 0 {
            write!(formatter, ", ")?;
          }

          write!(formatter, "{}", item)?;
        }

        write!(formatter, "]")
      }

      Shape::PartialRef(name) => write!(formatter, "PartialRef<\"{}\">", name),
      Shape::Dynamic => write!(formatter, "Dynamic"),
      Shape::Empty => write!(formatter, "Empty"),
    }
  }
}

impl fmt::Display for ElementShape {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(formatter, "Element<{}", self.tag)?;

    if !self.attributes.is_empty() {
      write!(formatter, ", {{")?;

      for (index, attribute) in self.attributes.iter().enumerate() {
        if index > 0 {
          write!(formatter, ", ")?;
        }

        write!(formatter, "{}", attribute)?;
      }

      write!(formatter, "}}")?;
    }

    write!(formatter, ">")?;

    if !self.children.is_empty() {
      write!(formatter, "(")?;

      for (index, child) in self.children.iter().enumerate() {
        if index > 0 {
          write!(formatter, ", ")?;
        }

        write!(formatter, "{}", child)?;
      }

      write!(formatter, ")")?;
    }

    Ok(())
  }
}

impl fmt::Display for TagName {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      TagName::Static(name) => write!(formatter, "\"{}\"", name),
      TagName::Dynamic => write!(formatter, "dynamic"),
    }
  }
}

impl fmt::Display for ShapeAttribute {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      ShapeAttribute::Static { name, value } => {
        write!(formatter, "{}: {}", name, value)
      }

      ShapeAttribute::Optional { name, value } => {
        write!(formatter, "{}?: {}", name, value)
      }

      ShapeAttribute::DynamicName => write!(formatter, "...dynamic"),
    }
  }
}

impl fmt::Display for AttributeValue {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      AttributeValue::Static(value) => write!(formatter, "\"{}\"", value),
      AttributeValue::Dynamic => write!(formatter, "dynamic"),
      AttributeValue::Mixed => write!(formatter, "mixed"),
      AttributeValue::Boolean => write!(formatter, "boolean"),
    }
  }
}
