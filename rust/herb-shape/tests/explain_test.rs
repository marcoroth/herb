use herb_shape::diff::*;
use herb_shape::explain::*;
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
fn test_explain_identical() {
  let result = DiffResult { differences: vec![] };

  assert_eq!(explain(&result), "The two templates produce identical shapes.");
}

#[test]
fn test_explain_tag_rename() {
  let difference = ShapeDifference {
    path: vec!["div".to_string()],
    kind: DiffKind::Changed,
    left: Some("tag: \"div\"".to_string()),
    right: Some("tag: \"section\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The <div> element was replaced with a <section>");
}

#[test]
fn test_explain_attribute_added() {
  let difference = ShapeDifference {
    path: vec!["div".to_string()],
    kind: DiffKind::Added,
    left: None,
    right: Some("attr: class: \"card\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @r#"A `class` attribute with value "card" was added to the <div> element"#);
}

#[test]
fn test_explain_attribute_removed() {
  let difference = ShapeDifference {
    path: vec!["div".to_string()],
    kind: DiffKind::Removed,
    left: Some("attr: class: \"card\"".to_string()),
    right: None,
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The `class` attribute was removed from the <div> element");
}

#[test]
fn test_explain_attribute_value_changed() {
  let difference = ShapeDifference {
    path: vec!["div".to_string()],
    kind: DiffKind::Changed,
    left: Some("attr: class: \"card\"".to_string()),
    right: Some("attr: class: \"panel\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @r#"The `class` attribute on the <div> element changed from "card" to "panel""#);
}

#[test]
fn test_explain_child_added() {
  let difference = ShapeDifference {
    path: vec!["div".to_string(), "child[1]".to_string()],
    kind: DiffKind::Added,
    left: None,
    right: Some("Element<\"img\">".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"a <img> element was added in <div>");
}

#[test]
fn test_explain_child_removed() {
  let difference = ShapeDifference {
    path: vec!["div".to_string(), "child[1]".to_string()],
    kind: DiffKind::Removed,
    left: Some("Element<\"img\">".to_string()),
    right: None,
  };

  insta::assert_snapshot!(explain_difference(&difference), @"a <img> element was removed in <div>");
}

#[test]
fn test_explain_shape_type_changed() {
  let difference = ShapeDifference {
    path: vec!["div".to_string(), "child[0]".to_string()],
    kind: DiffKind::Changed,
    left: Some("Text".to_string()),
    right: Some("Dynamic".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"text content in <div> was replaced with dynamic content");
}

#[test]
fn test_explain_void_changed() {
  let difference = ShapeDifference {
    path: vec!["br".to_string()],
    kind: DiffKind::Changed,
    left: Some("void: true".to_string()),
    right: Some("void: false".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"the <br> element changed from a void element to a non-void element");
}

#[test]
fn test_explain_partial_ref_changed() {
  let difference = ShapeDifference {
    path: vec![],
    kind: DiffKind::Changed,
    left: Some("PartialRef<\"user_card\">".to_string()),
    right: Some("PartialRef<\"profile_card\">".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The partial reference at the root changed from `user_card` to `profile_card`");
}

#[test]
fn test_explain_nested_location() {
  let difference = ShapeDifference {
    path: vec![
      "div".to_string(),
      "child[0]".to_string(),
      "ul".to_string(),
      "child[0]".to_string(),
      "li".to_string(),
    ],
    kind: DiffKind::Changed,
    left: Some("tag: \"li\"".to_string()),
    right: Some("tag: \"span\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The <li> element in <ul> inside <div> was replaced with a <span>");
}

#[test]
fn test_explain_inside_optional() {
  let difference = ShapeDifference {
    path: vec!["Optional".to_string(), "div".to_string()],
    kind: DiffKind::Changed,
    left: Some("tag: \"div\"".to_string()),
    right: Some("tag: \"span\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The <div> element inside a conditional block was replaced with a <span>");
}

#[test]
fn test_explain_inside_repeated() {
  let difference = ShapeDifference {
    path: vec!["Repeated".to_string(), "li".to_string()],
    kind: DiffKind::Changed,
    left: Some("tag: \"li\"".to_string()),
    right: Some("tag: \"span\"".to_string()),
  };

  insta::assert_snapshot!(explain_difference(&difference), @"The <li> element inside a loop was replaced with a <span>");
}

#[test]
fn test_explain_full_diff() {
  let left = element(
    "div",
    vec![static_attribute("class", "card")],
    vec![
      element("p", vec![], vec![Shape::Text]),
      void_element("img", vec![static_attribute("alt", "Photo")]),
    ],
  );

  let right = element(
    "section",
    vec![static_attribute("class", "card")],
    vec![element("p", vec![], vec![Shape::Dynamic])],
  );

  let result = diff_shapes(&left, &right);

  insta::assert_snapshot!(explain(&result));
}

#[test]
fn test_describe_shape_values() {
  insta::assert_snapshot!(explain_difference(&ShapeDifference {
    path: vec!["div".to_string(), "child[0]".to_string()],
    kind: DiffKind::Changed,
    left: Some("Text".to_string()),
    right: Some("Dynamic".to_string()),
  }), @"text content in <div> was replaced with dynamic content");

  insta::assert_snapshot!(explain_difference(&ShapeDifference {
    path: vec!["div".to_string(), "child[0]".to_string()],
    kind: DiffKind::Added,
    left: None,
    right: Some("Element<\"img\">".to_string()),
  }), @"a <img> element was added in <div>");

  insta::assert_snapshot!(explain_difference(&ShapeDifference {
    path: vec!["div".to_string(), "child[0]".to_string()],
    kind: DiffKind::Added,
    left: None,
    right: Some("Element<\"div\">(3 children)".to_string()),
  }), @"a <div> element (with children) was added in <div>");
}
