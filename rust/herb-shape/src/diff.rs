use std::fmt;

use serde::Serialize;

use crate::shape::{ElementShape, Shape, ShapeAttribute, TagName};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffKind {
  Added,
  Removed,
  Changed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ShapeDifference {
  pub path: Vec<String>,
  pub kind: DiffKind,
  pub left: Option<String>,
  pub right: Option<String>,
}

impl fmt::Display for ShapeDifference {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    let path_string = if self.path.is_empty() { "(root)".to_string() } else { self.path.join(" > ") };

    match self.kind {
      DiffKind::Added => {
        write!(formatter, "  + {} added: {}", path_string, self.right.as_deref().unwrap_or("(unknown)"))
      }

      DiffKind::Removed => {
        write!(formatter, "  - {} removed: {}", path_string, self.left.as_deref().unwrap_or("(unknown)"))
      }

      DiffKind::Changed => {
        write!(
          formatter,
          "  ~ {} changed: {} -> {}",
          path_string,
          self.left.as_deref().unwrap_or("(unknown)"),
          self.right.as_deref().unwrap_or("(unknown)")
        )
      }
    }
  }
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffResult {
  pub differences: Vec<ShapeDifference>,
}

impl DiffResult {
  pub fn is_identical(&self) -> bool {
    self.differences.is_empty()
  }
}

impl fmt::Display for DiffResult {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    if self.is_identical() {
      write!(formatter, "Shapes are identical.")
    } else {
      writeln!(formatter, "Found {} difference(s):", self.differences.len())?;

      for difference in &self.differences {
        writeln!(formatter, "{}", difference)?;
      }

      Ok(())
    }
  }
}

pub fn diff_shapes(left: &Shape, right: &Shape) -> DiffResult {
  let mut differences = Vec::new();
  let mut path = Vec::new();

  diff_recursive(left, right, &mut path, &mut differences);

  DiffResult { differences }
}

fn diff_recursive(left: &Shape, right: &Shape, path: &mut Vec<String>, differences: &mut Vec<ShapeDifference>) {
  if left == right {
    return;
  }

  match (left, right) {
    (Shape::Element(left_element), Shape::Element(right_element)) => diff_elements(left_element, right_element, path, differences),

    (Shape::Sequence(left_items), Shape::Sequence(right_items)) => diff_lists(left_items, right_items, "item", path, differences),

    (Shape::Union(left_variants), Shape::Union(right_variants)) => diff_lists(left_variants, right_variants, "variant", path, differences),

    (Shape::Optional(left_inner), Shape::Optional(right_inner)) => {
      path.push("Optional".to_string());
      diff_recursive(left_inner, right_inner, path, differences);
      path.pop();
    }

    (Shape::Repeated(left_inner), Shape::Repeated(right_inner)) => {
      path.push("Repeated".to_string());
      diff_recursive(left_inner, right_inner, path, differences);
      path.pop();
    }

    (Shape::PartialRef(left_name), Shape::PartialRef(right_name)) => {
      if left_name != right_name {
        differences.push(ShapeDifference {
          path: path.clone(),
          kind: DiffKind::Changed,
          left: Some(format!("PartialRef<\"{}\">", left_name)),
          right: Some(format!("PartialRef<\"{}\">", right_name)),
        });
      }
    }

    _ => {
      differences.push(ShapeDifference {
        path: path.clone(),
        kind: DiffKind::Changed,
        left: Some(shape_summary(left)),
        right: Some(shape_summary(right)),
      });
    }
  }
}

fn diff_elements(left: &ElementShape, right: &ElementShape, path: &mut Vec<String>, differences: &mut Vec<ShapeDifference>) {
  let tag_label = match &left.tag {
    TagName::Static(name) => name.clone(),
    TagName::Dynamic => "dynamic".to_string(),
  };

  path.push(tag_label);

  if left.tag != right.tag {
    differences.push(ShapeDifference {
      path: path.clone(),
      kind: DiffKind::Changed,
      left: Some(format!("tag: {}", left.tag)),
      right: Some(format!("tag: {}", right.tag)),
    });
  }

  if left.is_void != right.is_void {
    differences.push(ShapeDifference {
      path: path.clone(),
      kind: DiffKind::Changed,
      left: Some(format!("void: {}", left.is_void)),
      right: Some(format!("void: {}", right.is_void)),
    });
  }

  diff_attributes(&left.attributes, &right.attributes, path, differences);
  diff_lists(&left.children, &right.children, "child", path, differences);

  path.pop();
}

fn diff_attributes(left: &[ShapeAttribute], right: &[ShapeAttribute], path: &mut Vec<String>, differences: &mut Vec<ShapeDifference>) {
  let left_by_name: Vec<(&str, &ShapeAttribute)> = left
    .iter()
    .filter_map(|attribute| attribute_name(attribute).map(|name| (name, attribute)))
    .collect();

  let right_by_name: Vec<(&str, &ShapeAttribute)> = right
    .iter()
    .filter_map(|attribute| attribute_name(attribute).map(|name| (name, attribute)))
    .collect();

  for (name, attribute) in &left_by_name {
    if !right_by_name.iter().any(|(other_name, _)| other_name == name) {
      differences.push(ShapeDifference {
        path: path.clone(),
        kind: DiffKind::Removed,
        left: Some(format!("attr: {}", attribute)),
        right: None,
      });
    }
  }

  for (name, attribute) in &right_by_name {
    if !left_by_name.iter().any(|(other_name, _)| other_name == name) {
      differences.push(ShapeDifference {
        path: path.clone(),
        kind: DiffKind::Added,
        left: None,
        right: Some(format!("attr: {}", attribute)),
      });
    }
  }

  for (name, left_attribute) in &left_by_name {
    if let Some((_, right_attribute)) = right_by_name.iter().find(|(other_name, _)| other_name == name) {
      if left_attribute != right_attribute {
        differences.push(ShapeDifference {
          path: path.clone(),
          kind: DiffKind::Changed,
          left: Some(format!("attr: {}", left_attribute)),
          right: Some(format!("attr: {}", right_attribute)),
        });
      }
    }
  }

  let left_dynamic = left.iter().filter(|attribute| matches!(attribute, ShapeAttribute::DynamicName)).count();
  let right_dynamic = right.iter().filter(|attribute| matches!(attribute, ShapeAttribute::DynamicName)).count();

  if left_dynamic != right_dynamic {
    differences.push(ShapeDifference {
      path: path.clone(),
      kind: DiffKind::Changed,
      left: Some(format!("dynamic attrs: {}", left_dynamic)),
      right: Some(format!("dynamic attrs: {}", right_dynamic)),
    });
  }
}

fn diff_lists(left: &[Shape], right: &[Shape], label: &str, path: &mut Vec<String>, differences: &mut Vec<ShapeDifference>) {
  let common = left.len().min(right.len());

  for index in 0..common {
    path.push(format!("{}[{}]", label, index));
    diff_recursive(&left[index], &right[index], path, differences);
    path.pop();
  }

  for index in common..left.len() {
    differences.push(ShapeDifference {
      path: {
        let mut new_path = path.clone();
        new_path.push(format!("{}[{}]", label, index));
        new_path
      },
      kind: DiffKind::Removed,
      left: Some(shape_summary(&left[index])),
      right: None,
    });
  }

  for index in common..right.len() {
    differences.push(ShapeDifference {
      path: {
        let mut new_path = path.clone();
        new_path.push(format!("{}[{}]", label, index));
        new_path
      },
      kind: DiffKind::Added,
      left: None,
      right: Some(shape_summary(&right[index])),
    });
  }
}

fn attribute_name(attribute: &ShapeAttribute) -> Option<&str> {
  match attribute {
    ShapeAttribute::Static { name, .. } => Some(name.as_str()),
    ShapeAttribute::Optional { name, .. } => Some(name.as_str()),
    ShapeAttribute::DynamicName => None,
  }
}

fn shape_summary(shape: &Shape) -> String {
  match shape {
    Shape::Element(element) => {
      let tag = match &element.tag {
        TagName::Static(name) => format!("\"{}\"", name),
        TagName::Dynamic => "dynamic".to_string(),
      };

      if element.children.is_empty() {
        format!("Element<{}>", tag)
      } else {
        format!("Element<{}>({} children)", tag, element.children.len())
      }
    }

    Shape::Text => "Text".to_string(),
    Shape::Comment => "Comment".to_string(),
    Shape::Doctype => "Doctype".to_string(),
    Shape::Optional(inner) => format!("Optional<{}>", shape_summary(inner)),
    Shape::Repeated(inner) => format!("Repeated<{}>", shape_summary(inner)),
    Shape::Sequence(items) => format!("Sequence({} items)", items.len()),
    Shape::Union(variants) => format!("Union({} variants)", variants.len()),
    Shape::PartialRef(name) => format!("PartialRef<\"{}\">", name),
    Shape::Dynamic => "Dynamic".to_string(),
    Shape::Empty => "Empty".to_string(),
  }
}
