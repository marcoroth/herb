use herb_shape::shape::*;

#[test]
fn test_display_text() {
  assert_eq!(format!("{}", Shape::Text), "Text");
}

#[test]
fn test_display_comment() {
  assert_eq!(format!("{}", Shape::Comment), "Comment");
}

#[test]
fn test_display_doctype() {
  assert_eq!(format!("{}", Shape::Doctype), "Doctype");
}

#[test]
fn test_display_dynamic() {
  assert_eq!(format!("{}", Shape::Dynamic), "Dynamic");
}

#[test]
fn test_display_empty() {
  assert_eq!(format!("{}", Shape::Empty), "Empty");
}

#[test]
fn test_display_partial_ref() {
  assert_eq!(format!("{}", Shape::PartialRef("user_card".to_string())), "PartialRef<\"user_card\">");
}

#[test]
fn test_display_simple_element() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![],
    children: vec![],
    is_void: false,
  });

  assert_eq!(format!("{}", shape), "Element<\"div\">");
}

#[test]
fn test_display_element_with_attributes() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![
      ShapeAttribute::Static {
        name: "class".to_string(),
        value: AttributeValue::Static("card".to_string()),
      },
      ShapeAttribute::Static {
        name: "id".to_string(),
        value: AttributeValue::Dynamic,
      },
    ],
    children: vec![],
    is_void: false,
  });

  assert_eq!(format!("{}", shape), "Element<\"div\", {class: \"card\", id: dynamic}>");
}

#[test]
fn test_display_element_with_children() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![],
    children: vec![Shape::Text, Shape::Dynamic],
    is_void: false,
  });

  assert_eq!(format!("{}", shape), "Element<\"div\">(Text, Dynamic)");
}

#[test]
fn test_display_element_with_attributes_and_children() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![ShapeAttribute::Static {
      name: "class".to_string(),
      value: AttributeValue::Static("card".to_string()),
    }],
    children: vec![Shape::Text],
    is_void: false,
  });

  assert_eq!(format!("{}", shape), "Element<\"div\", {class: \"card\"}>(Text)");
}

#[test]
fn test_display_optional() {
  let shape = Shape::Optional(Box::new(Shape::Element(ElementShape {
    tag: TagName::Static("p".to_string()),
    attributes: vec![],
    children: vec![],
    is_void: false,
  })));

  assert_eq!(format!("{}", shape), "Optional<Element<\"p\">>");
}

#[test]
fn test_display_union() {
  let shape = Shape::Union(vec![
    Shape::Element(ElementShape {
      tag: TagName::Static("p".to_string()),
      attributes: vec![],
      children: vec![],
      is_void: false,
    }),
    Shape::Element(ElementShape {
      tag: TagName::Static("span".to_string()),
      attributes: vec![],
      children: vec![],
      is_void: false,
    }),
  ]);

  assert_eq!(format!("{}", shape), "Union<Element<\"p\"> | Element<\"span\">>");
}

#[test]
fn test_display_repeated() {
  let shape = Shape::Repeated(Box::new(Shape::Element(ElementShape {
    tag: TagName::Static("li".to_string()),
    attributes: vec![],
    children: vec![Shape::Text],
    is_void: false,
  })));

  assert_eq!(format!("{}", shape), "Repeated<Element<\"li\">(Text)>");
}

#[test]
fn test_display_sequence() {
  let shape = Shape::Sequence(vec![Shape::Text, Shape::Comment, Shape::Text]);

  assert_eq!(format!("{}", shape), "[Text, Comment, Text]");
}

#[test]
fn test_display_boolean_attribute() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("input".to_string()),
    attributes: vec![ShapeAttribute::Static {
      name: "disabled".to_string(),
      value: AttributeValue::Boolean,
    }],
    children: vec![],
    is_void: true,
  });

  assert_eq!(format!("{}", shape), "Element<\"input\", {disabled: boolean}>");
}

#[test]
fn test_display_mixed_attribute() {
  let attribute = ShapeAttribute::Static {
    name: "class".to_string(),
    value: AttributeValue::Mixed,
  };

  assert_eq!(format!("{}", attribute), "class: mixed");
}

#[test]
fn test_display_optional_attribute() {
  let attribute = ShapeAttribute::Optional {
    name: "data-active".to_string(),
    value: AttributeValue::Boolean,
  };

  assert_eq!(format!("{}", attribute), "data-active?: boolean");
}

#[test]
fn test_display_dynamic_name_attribute() {
  assert_eq!(format!("{}", ShapeAttribute::DynamicName), "...dynamic");
}

#[test]
fn test_display_dynamic_tag() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Dynamic,
    attributes: vec![],
    children: vec![],
    is_void: false,
  });

  assert_eq!(format!("{}", shape), "Element<dynamic>");
}

#[test]
fn test_display_complex_nested() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![ShapeAttribute::Static {
      name: "class".to_string(),
      value: AttributeValue::Static("card".to_string()),
    }],
    children: vec![
      Shape::Element(ElementShape {
        tag: TagName::Static("h2".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
      Shape::Optional(Box::new(Shape::Element(ElementShape {
        tag: TagName::Static("img".to_string()),
        attributes: vec![
          ShapeAttribute::Static {
            name: "src".to_string(),
            value: AttributeValue::Dynamic,
          },
          ShapeAttribute::Static {
            name: "alt".to_string(),
            value: AttributeValue::Static("Avatar".to_string()),
          },
        ],
        children: vec![],
        is_void: true,
      }))),
      Shape::Repeated(Box::new(Shape::Element(ElementShape {
        tag: TagName::Static("span".to_string()),
        attributes: vec![ShapeAttribute::Static {
          name: "class".to_string(),
          value: AttributeValue::Static("badge".to_string()),
        }],
        children: vec![Shape::Text],
        is_void: false,
      }))),
    ],
    is_void: false,
  });

  assert_eq!(
    format!("{}", shape),
    "Element<\"div\", {class: \"card\"}>(Element<\"h2\">(Text), Optional<Element<\"img\", {src: dynamic, alt: \"Avatar\"}>>, Repeated<Element<\"span\", {class: \"badge\"}>(Text)>)"
  );
}
