use herb_shape::diff::*;
use herb_shape::shape::*;

fn element(tag: &str, attributes: Vec<ShapeAttribute>, children: Vec<Shape>) -> Shape {
  Shape::Element(ElementShape {
    tag: TagName::Static(tag.to_string()),
    attributes,
    children,
    is_void: false,
  })
}

fn void_element(tag: &str, attributes: Vec<ShapeAttribute>) -> Shape {
  Shape::Element(ElementShape {
    tag: TagName::Static(tag.to_string()),
    attributes,
    children: vec![],
    is_void: true,
  })
}

fn static_attribute(name: &str, value: &str) -> ShapeAttribute {
  ShapeAttribute::Static {
    name: name.to_string(),
    value: AttributeValue::Static(value.to_string()),
  }
}

#[test]
fn test_identical_shapes() {
  let shape = element("div", vec![], vec![Shape::Text]);
  let result = diff_shapes(&shape, &shape);

  assert!(result.is_identical());
}

#[test]
fn test_different_root_type() {
  let result = diff_shapes(&Shape::Text, &Shape::Comment);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Changed);
  assert_eq!(result.differences[0].left.as_deref(), Some("Text"));
  assert_eq!(result.differences[0].right.as_deref(), Some("Comment"));
}

#[test]
fn test_tag_name_changed() {
  let left = element("div", vec![], vec![]);
  let right = element("section", vec![], vec![]);
  let result = diff_shapes(&left, &right);

  assert!(!result.is_identical());
  assert!(result.differences.iter().any(|difference| difference.kind == DiffKind::Changed
    && difference.left.as_ref().unwrap().contains("div")
    && difference.right.as_ref().unwrap().contains("section")));
}

#[test]
fn test_attribute_added() {
  let left = element("div", vec![], vec![]);
  let right = element("div", vec![static_attribute("class", "card")], vec![]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Added);
  assert!(result.differences[0].right.as_ref().unwrap().contains("class"));
}

#[test]
fn test_attribute_removed() {
  let left = element("div", vec![static_attribute("class", "card")], vec![]);
  let right = element("div", vec![], vec![]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Removed);
  assert!(result.differences[0].left.as_ref().unwrap().contains("class"));
}

#[test]
fn test_attribute_value_changed() {
  let left = element("div", vec![static_attribute("class", "card")], vec![]);
  let right = element("div", vec![static_attribute("class", "panel")], vec![]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Changed);
}

#[test]
fn test_child_added() {
  let left = element("div", vec![], vec![]);
  let right = element("div", vec![], vec![Shape::Text]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Added);
}

#[test]
fn test_child_removed() {
  let left = element("div", vec![], vec![Shape::Text]);
  let right = element("div", vec![], vec![]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Removed);
}

#[test]
fn test_child_changed() {
  let left = element("div", vec![], vec![Shape::Text]);
  let right = element("div", vec![], vec![Shape::Dynamic]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Changed);
}

#[test]
fn test_nested_element_difference() {
  let left = element("div", vec![], vec![element("p", vec![], vec![Shape::Text])]);
  let right = element("div", vec![], vec![element("p", vec![], vec![Shape::Dynamic])]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].path, vec!["div", "child[0]", "p", "child[0]"]);
}

#[test]
fn test_optional_inner_changed() {
  let left = Shape::Optional(Box::new(Shape::Text));
  let right = Shape::Optional(Box::new(Shape::Dynamic));
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].path, vec!["Optional"]);
}

#[test]
fn test_repeated_inner_changed() {
  let left = Shape::Repeated(Box::new(element("li", vec![], vec![Shape::Text])));
  let right = Shape::Repeated(Box::new(element("li", vec![], vec![Shape::Dynamic])));
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
}

#[test]
fn test_sequence_length_change() {
  let left = Shape::Sequence(vec![Shape::Text, Shape::Comment]);
  let right = Shape::Sequence(vec![Shape::Text]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Removed);
}

#[test]
fn test_union_variant_change() {
  let left = Shape::Union(vec![Shape::Text, Shape::Comment]);
  let right = Shape::Union(vec![Shape::Text, Shape::Dynamic]);
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert_eq!(result.differences[0].kind, DiffKind::Changed);
}

#[test]
fn test_partial_ref_changed() {
  let left = Shape::PartialRef("user_card".to_string());
  let right = Shape::PartialRef("profile_card".to_string());
  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert!(result.differences[0].left.as_ref().unwrap().contains("user_card"));
  assert!(result.differences[0].right.as_ref().unwrap().contains("profile_card"));
}

#[test]
fn test_display_diff_result_identical() {
  let result = DiffResult { differences: vec![] };

  assert_eq!(format!("{}", result), "Shapes are identical.");
}

#[test]
fn test_display_diff_result_with_differences() {
  let result = DiffResult {
    differences: vec![ShapeDifference {
      path: vec!["div".to_string()],
      kind: DiffKind::Changed,
      left: Some("tag: \"div\"".to_string()),
      right: Some("tag: \"section\"".to_string()),
    }],
  };

  let output = format!("{}", result);

  assert!(output.contains("1 difference(s)"));
  assert!(output.contains("div"));
}

#[test]
fn test_complex_diff() {
  let left = element(
    "div",
    vec![static_attribute("class", "card")],
    vec![
      element("h2", vec![], vec![Shape::Dynamic]),
      Shape::Optional(Box::new(void_element(
        "img",
        vec![static_attribute("src", "photo.jpg"), static_attribute("alt", "Photo")],
      ))),
      element("ul", vec![], vec![Shape::Repeated(Box::new(element("li", vec![], vec![Shape::Text])))]),
    ],
  );

  let right = element(
    "section",
    vec![static_attribute("class", "card"), static_attribute("role", "region")],
    vec![
      element("h2", vec![], vec![Shape::Dynamic]),
      Shape::Optional(Box::new(void_element(
        "img",
        vec![static_attribute("src", "photo.jpg"), static_attribute("alt", "Photo")],
      ))),
      element("ul", vec![], vec![Shape::Repeated(Box::new(element("li", vec![], vec![Shape::Dynamic])))]),
    ],
  );

  let result = diff_shapes(&left, &right);

  assert!(!result.is_identical());
  assert!(result.differences.len() >= 2);
}

#[test]
fn test_void_status_changed() {
  let left = Shape::Element(ElementShape {
    tag: TagName::Static("br".to_string()),
    attributes: vec![],
    children: vec![],
    is_void: true,
  });

  let right = Shape::Element(ElementShape {
    tag: TagName::Static("br".to_string()),
    attributes: vec![],
    children: vec![],
    is_void: false,
  });

  let result = diff_shapes(&left, &right);

  assert_eq!(result.differences.len(), 1);
  assert!(result.differences[0].left.as_ref().unwrap().contains("void: true"));
}
