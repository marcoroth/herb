use herb_shape::shape::*;
use herb_shape::simplify::simplify;

#[test]
fn test_simplify_empty_sequence() {
  assert_eq!(simplify(Shape::Sequence(vec![])), Shape::Empty);
}

#[test]
fn test_simplify_single_element_sequence() {
  assert_eq!(simplify(Shape::Sequence(vec![Shape::Text])), Shape::Text);
}

#[test]
fn test_simplify_sequence_filters_empty() {
  assert_eq!(simplify(Shape::Sequence(vec![Shape::Empty, Shape::Text, Shape::Empty])), Shape::Text);
}

#[test]
fn test_simplify_flatten_nested_sequence() {
  assert_eq!(
    simplify(Shape::Sequence(vec![Shape::Text, Shape::Sequence(vec![Shape::Comment, Shape::Doctype])])),
    Shape::Sequence(vec![Shape::Text, Shape::Comment, Shape::Doctype])
  );
}

#[test]
fn test_simplify_empty_union() {
  assert_eq!(simplify(Shape::Union(vec![])), Shape::Empty);
}

#[test]
fn test_simplify_single_variant_union() {
  assert_eq!(simplify(Shape::Union(vec![Shape::Text])), Shape::Text);
}

#[test]
fn test_simplify_flatten_nested_union() {
  assert_eq!(
    simplify(Shape::Union(vec![Shape::Text, Shape::Union(vec![Shape::Comment, Shape::Doctype])])),
    Shape::Union(vec![Shape::Text, Shape::Comment, Shape::Doctype])
  );
}

#[test]
fn test_simplify_deduplicate_union() {
  assert_eq!(
    simplify(Shape::Union(vec![Shape::Text, Shape::Text, Shape::Comment])),
    Shape::Union(vec![Shape::Text, Shape::Comment])
  );
}

#[test]
fn test_simplify_optional_empty() {
  assert_eq!(simplify(Shape::Optional(Box::new(Shape::Empty))), Shape::Empty);
}

#[test]
fn test_simplify_optional_optional() {
  assert_eq!(
    simplify(Shape::Optional(Box::new(Shape::Optional(Box::new(Shape::Text))))),
    Shape::Optional(Box::new(Shape::Text))
  );
}

#[test]
fn test_simplify_merge_consecutive_text() {
  assert_eq!(
    simplify(Shape::Sequence(vec![Shape::Text, Shape::Text, Shape::Comment, Shape::Text])),
    Shape::Sequence(vec![Shape::Text, Shape::Comment, Shape::Text])
  );
}

#[test]
fn test_simplify_repeated_empty() {
  assert_eq!(simplify(Shape::Repeated(Box::new(Shape::Empty))), Shape::Empty);
}

#[test]
fn test_simplify_element_children() {
  let shape = Shape::Element(ElementShape {
    tag: TagName::Static("div".to_string()),
    attributes: vec![],
    children: vec![Shape::Empty, Shape::Text, Shape::Empty],
    is_void: false,
  });

  assert_eq!(
    simplify(shape),
    Shape::Element(ElementShape {
      tag: TagName::Static("div".to_string()),
      attributes: vec![],
      children: vec![Shape::Text],
      is_void: false,
    })
  );
}

#[test]
fn test_simplify_deeply_nested() {
  let shape = Shape::Sequence(vec![Shape::Sequence(vec![Shape::Sequence(vec![Shape::Text])])]);

  assert_eq!(simplify(shape), Shape::Text);
}
