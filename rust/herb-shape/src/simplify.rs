use crate::shape::Shape;

pub fn simplify(shape: Shape) -> Shape {
  simplify_recursive(shape)
}

fn simplify_recursive(shape: Shape) -> Shape {
  match shape {
    Shape::Sequence(items) => simplify_sequence(items),
    Shape::Union(variants) => simplify_union(variants),
    Shape::Optional(inner) => simplify_optional(*inner),

    Shape::Repeated(inner) => {
      let simplified = simplify_recursive(*inner);

      if simplified == Shape::Empty {
        Shape::Empty
      } else {
        Shape::Repeated(Box::new(simplified))
      }
    }

    Shape::Element(mut element) => {
      element.children = element.children.into_iter().map(simplify_recursive).collect();
      let children = simplify_children(element.children);
      element.children = children;

      Shape::Element(element)
    }

    other => other,
  }
}

fn simplify_sequence(items: Vec<Shape>) -> Shape {
  let items: Vec<Shape> = items.into_iter().map(simplify_recursive).collect();
  let items = flatten_sequences(items);
  let items: Vec<Shape> = items.into_iter().filter(|shape| *shape != Shape::Empty).collect();
  let items = merge_consecutive_text(items);

  match items.len() {
    0 => Shape::Empty,
    1 => items.into_iter().next().unwrap(),
    _ => Shape::Sequence(items),
  }
}

fn simplify_union(variants: Vec<Shape>) -> Shape {
  let variants: Vec<Shape> = variants.into_iter().map(simplify_recursive).collect();
  let variants = flatten_unions(variants);
  let variants = deduplicate(variants);

  match variants.len() {
    0 => Shape::Empty,
    1 => variants.into_iter().next().unwrap(),
    _ => Shape::Union(variants),
  }
}

fn simplify_optional(inner: Shape) -> Shape {
  let simplified = simplify_recursive(inner);

  match simplified {
    Shape::Empty => Shape::Empty,
    Shape::Optional(_) => simplified,
    other => Shape::Optional(Box::new(other)),
  }
}

fn simplify_children(children: Vec<Shape>) -> Vec<Shape> {
  let children = flatten_sequences(children);
  let children: Vec<Shape> = children.into_iter().filter(|shape| *shape != Shape::Empty).collect();

  merge_consecutive_text(children)
}

fn flatten_sequences(items: Vec<Shape>) -> Vec<Shape> {
  let mut result = Vec::new();

  for item in items {
    match item {
      Shape::Sequence(inner) => result.extend(inner),
      other => result.push(other),
    }
  }

  result
}

fn flatten_unions(variants: Vec<Shape>) -> Vec<Shape> {
  let mut result = Vec::new();

  for variant in variants {
    match variant {
      Shape::Union(inner) => result.extend(inner),
      other => result.push(other),
    }
  }

  result
}

fn deduplicate(variants: Vec<Shape>) -> Vec<Shape> {
  let mut seen = Vec::new();

  for variant in variants {
    if !seen.contains(&variant) {
      seen.push(variant);
    }
  }

  seen
}

fn merge_consecutive_text(items: Vec<Shape>) -> Vec<Shape> {
  let mut result: Vec<Shape> = Vec::new();

  for item in items {
    if item == Shape::Text {
      if result.last() == Some(&Shape::Text) {
        continue;
      }
    }

    result.push(item);
  }

  result
}
