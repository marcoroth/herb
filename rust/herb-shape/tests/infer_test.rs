use herb_shape::infer::infer_shape;
use herb_shape::shape::*;

fn infer(source: &str) -> Shape {
  let result = herb::parse(source).expect("parse failed");

  infer_shape(&result)
}

#[test]
fn test_empty_template() {
  assert_eq!(infer(""), Shape::Empty);
}

#[test]
fn test_single_element() {
  let shape = infer("<div></div>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![],
      children: vec![],
      is_void: false,
    })
  );
}

#[test]
fn test_void_element() {
  let shape = infer("<br>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("br".to_string()),
      attributes: vec![],
      children: vec![],
      is_void: true,
    })
  );
}

#[test]
fn test_element_with_text() {
  let shape = infer("<p>hello</p>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("p".to_string()),
      attributes: vec![],
      children: vec![Shape::Text],
      is_void: false,
    })
  );
}

#[test]
fn test_element_with_static_attribute() {
  let shape = infer("<div class=\"card\"></div>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![ShapeAttribute::Static {
        name: "class".to_string(),
        value: AttributeValue::Static("card".to_string()),
      }],
      children: vec![],
      is_void: false,
    })
  );
}

#[test]
fn test_element_with_boolean_attribute() {
  let shape = infer("<input disabled>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("input".to_string()),
      attributes: vec![ShapeAttribute::Static {
        name: "disabled".to_string(),
        value: AttributeValue::Boolean,
      }],
      children: vec![],
      is_void: true,
    })
  );
}

#[test]
fn test_element_with_dynamic_attribute_value() {
  let shape = infer("<div id=\"<%= dom_id(user) %>\"></div>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![ShapeAttribute::Static {
        name: "id".to_string(),
        value: AttributeValue::Dynamic,
      }],
      children: vec![],
      is_void: false,
    })
  );
}

#[test]
fn test_element_with_mixed_attribute_value() {
  let shape = infer("<div class=\"card <%= active_class %>\"></div>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![ShapeAttribute::Static {
        name: "class".to_string(),
        value: AttributeValue::Mixed,
      }],
      children: vec![],
      is_void: false,
    })
  );
}

#[test]
fn test_nested_elements() {
  let shape = infer("<div><p>text</p></div>");

  assert_eq!(
    shape,
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![],
      children: vec![Shape::Element(ElementShape {
        tag: TagName::Static("p".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      })],
      is_void: false,
    })
  );
}

#[test]
fn test_sibling_elements() {
  let shape = infer("<p>a</p><p>b</p>");

  assert_eq!(
    shape,
    Shape::Sequence(vec![
      Shape::Element(ElementShape {
        tag: TagName::Static("p".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
      Shape::Element(ElementShape {
        tag: TagName::Static("p".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
    ])
  );
}

#[test]
fn test_erb_output() {
  let shape = infer("<%= user.name %>");

  assert_eq!(shape, Shape::Dynamic);
}

#[test]
fn test_erb_silent() {
  let shape = infer("<% x = 1 %>");

  assert_eq!(shape, Shape::Empty);
}

#[test]
fn test_erb_comment() {
  let shape = infer("<%# comment %>");

  assert_eq!(shape, Shape::Empty);
}

#[test]
fn test_html_comment() {
  let shape = infer("<!-- comment -->");

  assert_eq!(shape, Shape::Comment);
}

#[test]
fn test_doctype() {
  let shape = infer("<!DOCTYPE html>");

  assert_eq!(shape, Shape::Doctype);
}

#[test]
fn test_if_without_else() {
  let shape = infer("<% if show? %><p>hello</p><% end %>");

  assert_eq!(
    shape,
    Shape::Optional(Box::new(Shape::Element(ElementShape {
      tag: TagName::Static("p".to_string()),
      attributes: vec![],
      children: vec![Shape::Text],
      is_void: false,
    })))
  );
}

#[test]
fn test_if_with_else() {
  let shape = infer("<% if show? %><p>yes</p><% else %><span>no</span><% end %>");

  assert_eq!(
    shape,
    Shape::Union(vec![
      Shape::Element(ElementShape {
        tag: TagName::Static("p".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
      Shape::Element(ElementShape {
        tag: TagName::Static("span".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
    ])
  );
}

#[test]
fn test_unless_without_else() {
  let shape = infer("<% unless hidden? %><p>visible</p><% end %>");

  assert_eq!(
    shape,
    Shape::Optional(Box::new(Shape::Element(ElementShape {
      tag: TagName::Static("p".to_string()),
      attributes: vec![],
      children: vec![Shape::Text],
      is_void: false,
    })))
  );
}

#[test]
fn test_each_loop() {
  let shape = infer("<% items.each do |item| %><li><%= item %></li><% end %>");

  assert_eq!(
    shape,
    Shape::Repeated(Box::new(Shape::Element(ElementShape {
      tag: TagName::Static("li".to_string()),
      attributes: vec![],
      children: vec![Shape::Dynamic],
      is_void: false,
    })))
  );
}

#[test]
fn test_render_partial() {
  let shape = infer("<%= render \"user_card\" %>");

  assert_eq!(shape, Shape::PartialRef("user_card".to_string()));
}

#[test]
fn test_render_partial_single_quotes() {
  let shape = infer("<%= render 'user_card' %>");

  assert_eq!(shape, Shape::PartialRef("user_card".to_string()));
}

#[test]
fn test_render_partial_with_path() {
  let shape = infer("<%= render \"shared/user_card\" %>");

  assert_eq!(shape, Shape::PartialRef("shared/user_card".to_string()));
}

#[test]
fn test_render_partial_keyword() {
  let shape = infer("<%= render partial: \"user_card\" %>");

  assert_eq!(shape, Shape::PartialRef("user_card".to_string()));
}

#[test]
fn test_complex_erb_expression() {
  let shape = infer("<%= user.avatar.url %>");

  assert_eq!(shape, Shape::Dynamic);
}

#[test]
fn test_render_non_partial() {
  let shape = infer("<%= render @users %>");

  assert_eq!(shape, Shape::Dynamic);
}

#[test]
fn test_case_when() {
  let shape = infer("<% case role %><% when :admin %><strong>Admin</strong><% when :user %><span>User</span><% end %>");

  assert_eq!(
    shape,
    Shape::Union(vec![
      Shape::Element(ElementShape {
        tag: TagName::Static("strong".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
      Shape::Element(ElementShape {
        tag: TagName::Static("span".to_string()),
        attributes: vec![],
        children: vec![Shape::Text],
        is_void: false,
      }),
    ])
  );
}

#[test]
fn test_display_integration() {
  let shape = infer("<div class=\"card\"><h2><%= title %></h2></div>");
  let display = format!("{}", shape);

  assert_eq!(display, "Element<\"div\", {class: \"card\"}>(Element<\"h2\">(Dynamic))");
}

#[test]
fn test_display_optional_element() {
  let shape = infer("<% if show? %><p>hello</p><% end %>");
  let display = format!("{}", shape);

  assert_eq!(display, "Optional<Element<\"p\">(Text)>");
}

#[test]
fn test_display_repeated_element() {
  let shape = infer("<% items.each do |item| %><li><%= item %></li><% end %>");
  let display = format!("{}", shape);

  assert_eq!(display, "Repeated<Element<\"li\">(Dynamic)>");
}

#[test]
fn test_display_union() {
  let shape = infer("<% if admin? %><strong>Admin</strong><% else %><span>User</span><% end %>");
  let display = format!("{}", shape);

  assert_eq!(display, "Union<Element<\"strong\">(Text) | Element<\"span\">(Text)>");
}

#[test]
fn test_realistic_template_display() {
  let source = r#"<div class="card">
  <h2><%= user.name %></h2>
  <% if user.avatar? %>
    <img src="<%= user.avatar_url %>" alt="Avatar">
  <% end %>
  <ul>
    <% user.badges.each do |badge| %>
      <li class="badge"><%= badge.name %></li>
    <% end %>
  </ul>
</div>"#;
  let shape = infer(source);
  let display = format!("{}", shape);

  assert!(display.starts_with("Element<\"div\""));
  assert!(display.contains("Optional<"));
  assert!(display.contains("Repeated<"));
}

#[test]
fn test_realistic_template() {
  let source = r#"<div class="card">
  <h2><%= user.name %></h2>
  <% if user.avatar? %>
    <img src="<%= user.avatar_url %>" alt="Avatar">
  <% end %>
  <ul>
    <% user.badges.each do |badge| %>
      <li class="badge"><%= badge.name %></li>
    <% end %>
  </ul>
</div>"#;
  let shape = infer(source);

  match &shape {
    Shape::Element(element) => {
      assert_eq!(element.tag, TagName::Static("div".to_string()));
      assert!(!element.children.is_empty());
    }
    _ => panic!("Expected Element, got {:?}", shape),
  }
}

#[test]
fn test_erb_block_non_iteration() {
  let shape = infer("<%= form_for @user do |f| %><input><% end %>");

  match &shape {
    Shape::Element(element) => {
      assert_eq!(element.tag, TagName::Static("input".to_string()));
      assert!(element.is_void);
    }
    _ => panic!("Expected Element, got {:?}", shape),
  }
}

#[test]
fn test_multiple_attributes() {
  let shape = infer("<img src=\"photo.jpg\" alt=\"Photo\" class=\"thumb\">");

  match &shape {
    Shape::Element(element) => {
      assert_eq!(element.attributes.len(), 3);

      assert_eq!(
        element.attributes[0],
        ShapeAttribute::Static {
          name: "src".to_string(),
          value: AttributeValue::Static("photo.jpg".to_string()),
        }
      );

      assert_eq!(
        element.attributes[1],
        ShapeAttribute::Static {
          name: "alt".to_string(),
          value: AttributeValue::Static("Photo".to_string()),
        }
      );

      assert_eq!(
        element.attributes[2],
        ShapeAttribute::Static {
          name: "class".to_string(),
          value: AttributeValue::Static("thumb".to_string()),
        }
      );
    }
    _ => panic!("Expected Element, got {:?}", shape),
  }
}

#[test]
fn test_text_only() {
  let shape = infer("Hello World");

  assert_eq!(shape, Shape::Text);
}
