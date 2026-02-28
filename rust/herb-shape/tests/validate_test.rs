use herb_shape::shape::*;
use herb_shape::validate::*;

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

#[test]
fn test_valid_shape_no_diagnostics() {
  let shape = element("div", vec![], vec![element("p", vec![], vec![Shape::Text])]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty(), "Expected no diagnostics, got: {:?}", diagnostics);
}

#[test]
fn test_block_inside_phrasing() {
  let shape = element("p", vec![], vec![element("div", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Error);
  assert!(diagnostics[0].message.contains("<p> cannot contain block element <div>"));
  assert_eq!(diagnostics[0].path, vec!["p", "div"]);
}

#[test]
fn test_wrong_specific_children() {
  let shape = element("ul", vec![], vec![element("span", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<ul> cannot contain <span>"));
  assert!(diagnostics[0].message.contains("expected: li"));
}

#[test]
fn test_correct_specific_children() {
  let shape = element("ul", vec![], vec![element("li", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());
}

#[test]
fn test_void_with_children() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("br".to_string()),
    attributes: vec![],
    children: vec![Shape::Text],
    is_void: true,
  });

  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<br> is a void element and cannot have children"));
}

#[test]
fn test_missing_required_attribute() {
  let shape = void_element(
    "img",
    vec![ShapeAttribute::Static {
      name: "src".to_string(),
      value: AttributeValue::Static("photo.jpg".to_string()),
    }],
  );

  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert_eq!(diagnostics[0].severity, DiagnosticSeverity::Warning);
  assert!(diagnostics[0].message.contains("<img> is missing required attribute: alt"));
}

#[test]
fn test_required_attribute_present() {
  let shape = void_element(
    "img",
    vec![ShapeAttribute::Static {
      name: "alt".to_string(),
      value: AttributeValue::Static("Photo".to_string()),
    }],
  );

  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());
}

#[test]
fn test_dynamic_name_skips_required_check() {
  let shape = void_element("img", vec![ShapeAttribute::DynamicName]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());
}

#[test]
fn test_scope_head_only_in_body() {
  let shape = element("html", vec![], vec![element("body", vec![], vec![void_element("meta", vec![])])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<meta> is only valid inside <head>"));
}

#[test]
fn test_scope_body_only_in_head() {
  let shape = element("html", vec![], vec![element("head", vec![], vec![element("div", vec![], vec![])])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<div> is only valid inside <body>"));
}

#[test]
fn test_scope_head_or_body_allowed_in_head() {
  let shape = element("html", vec![], vec![element("head", vec![], vec![element("script", vec![], vec![])])]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());
}

#[test]
fn test_multiple_diagnostics() {
  let shape = element("p", vec![], vec![element("div", vec![], vec![]), element("h1", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 2);
}

#[test]
fn test_nested_violations() {
  let shape = element(
    "ul",
    vec![],
    vec![element("li", vec![], vec![element("p", vec![], vec![element("div", vec![], vec![])])])],
  );
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert_eq!(diagnostics[0].path, vec!["ul", "li", "p", "div"]);
}

#[test]
fn test_validates_inside_optional() {
  let shape = Shape::Optional(Box::new(element("p", vec![], vec![element("div", vec![], vec![])])));
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
}

#[test]
fn test_validates_inside_repeated() {
  let shape = Shape::Repeated(Box::new(element("p", vec![], vec![element("div", vec![], vec![])])));
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
}

#[test]
fn test_validates_inside_union() {
  let shape = Shape::Union(vec![
    element("p", vec![], vec![element("div", vec![], vec![])]),
    element("span", vec![], vec![]),
  ]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
}

#[test]
fn test_dynamic_tag_skipped() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Dynamic,
    attributes: vec![],
    children: vec![element("div", vec![], vec![])],
    is_void: false,
  });

  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());
}

#[test]
fn test_display_diagnostic() {
  let diagnostic = Diagnostic {
    severity: DiagnosticSeverity::Error,
    message: "<p> cannot contain block element <div>".to_string(),
    path: vec!["body".to_string(), "p".to_string(), "div".to_string()],
  };

  let output = format!("{}", diagnostic);

  assert!(output.contains("error:"));
  assert!(output.contains("body > p > div"));
}

#[test]
fn test_dl_specific_children() {
  let shape = element("dl", vec![], vec![element("dt", vec![], vec![]), element("dd", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());

  let shape = element("dl", vec![], vec![element("span", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("expected: dt, dd"));
}

#[test]
fn test_table_specific_children() {
  let shape = element("table", vec![], vec![element("tr", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert!(diagnostics.is_empty());

  let shape = element("table", vec![], vec![element("div", vec![], vec![])]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
}

#[test]
fn test_a_missing_href() {
  let shape = element("a", vec![], vec![Shape::Text]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<a> is missing required attribute: href"));
}

#[test]
fn test_iframe_missing_title() {
  let shape = element("iframe", vec![], vec![]);
  let diagnostics = validate(&shape);

  assert_eq!(diagnostics.len(), 1);
  assert!(diagnostics[0].message.contains("<iframe> is missing required attribute: title"));
}
