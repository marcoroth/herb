use crate::diff::{DiffKind, DiffResult, ShapeDifference};

pub fn explain(result: &DiffResult) -> String {
  if result.is_identical() {
    return "The two templates produce identical shapes.".to_string();
  }

  let mut lines: Vec<String> = Vec::new();

  for difference in &result.differences {
    lines.push(format!("- {}", explain_difference(difference)));
  }

  lines.join("\n")
}

pub fn explain_difference(difference: &ShapeDifference) -> String {
  let left = difference.left.as_deref().unwrap_or("");
  let right = difference.right.as_deref().unwrap_or("");
  let is_self_change =
    left.starts_with("tag:") || left.starts_with("void:") || left.starts_with("attr:") || left.starts_with("dynamic attrs:") || right.starts_with("attr:");

  let location = if is_self_change {
    describe_location_parent(&difference.path)
  } else {
    describe_location(&difference.path)
  };

  match difference.kind {
    DiffKind::Changed => explain_changed(left, right, &location, &difference.path),
    DiffKind::Added => explain_added(right, &location, &difference.path),
    DiffKind::Removed => explain_removed(left, &location, &difference.path),
  }
}

fn explain_changed(left: &str, right: &str, location: &str, path: &[String]) -> String {
  if let (Some(old_tag), Some(new_tag)) = (parse_tag_value(left), parse_tag_value(right)) {
    if location == "at the root" {
      return format!("The <{}> element was replaced with a <{}>", old_tag, new_tag);
    }

    return format!("The <{}> element {} was replaced with a <{}>", old_tag, location, new_tag);
  }

  if let (Some((name, old_value)), Some((_, new_value))) = (parse_attribute(left), parse_attribute(right)) {
    let element = last_tag_in_path(path);

    return format!("The `{}` attribute on {} changed from {} to {}", name, element, old_value, new_value);
  }

  if left.starts_with("void:") {
    let element = last_tag_in_path(path);
    let was_void = left.contains("true");

    if was_void {
      return format!("{} changed from a void element to a non-void element", element);
    } else {
      return format!("{} changed from a non-void element to a void element", element);
    }
  }

  if left.starts_with("dynamic attrs:") {
    let element = last_tag_in_path(path);
    let old_count = extract_number(left).unwrap_or(0);
    let new_count = extract_number(right).unwrap_or(0);

    if new_count > old_count {
      return format!("Dynamic attributes were added to {} ({} -> {})", element, old_count, new_count);
    } else {
      return format!("Dynamic attributes were removed from {} ({} -> {})", element, old_count, new_count);
    }
  }

  if let (Some(old_name), Some(new_name)) = (parse_partial_ref(left), parse_partial_ref(right)) {
    return format!("The partial reference {} changed from `{}` to `{}`", location, old_name, new_name);
  }

  let old_description = describe_shape_value(left);
  let new_description = describe_shape_value(right);

  format!("{} {} was replaced with {}", old_description, location, new_description)
}

fn explain_added(right: &str, location: &str, path: &[String]) -> String {
  if let Some((name, value)) = parse_attribute(right) {
    let element = last_tag_in_path(path);

    return format!("A `{}` attribute with value {} was added to {}", name, value, element);
  }

  let description = describe_shape_value(right);

  format!("{} was added {}", description, location)
}

fn explain_removed(left: &str, location: &str, path: &[String]) -> String {
  if let Some((name, _)) = parse_attribute(left) {
    let element = last_tag_in_path(path);

    return format!("The `{}` attribute was removed from {}", name, element);
  }

  let description = describe_shape_value(left);

  format!("{} was removed {}", description, location)
}

fn describe_location_parent(path: &[String]) -> String {
  let mut last_tag_index = None;

  for (index, segment) in path.iter().enumerate().rev() {
    if !segment.starts_with("child[") && !segment.starts_with("item[") && !segment.starts_with("variant[") && segment != "Optional" && segment != "Repeated" {
      last_tag_index = Some(index);

      break;
    }
  }

  match last_tag_index {
    Some(index) if index > 0 => describe_location(&path[..index]),
    _ => "at the root".to_string(),
  }
}

fn last_tag_in_path(path: &[String]) -> String {
  for segment in path.iter().rev() {
    if !segment.starts_with("child[") && !segment.starts_with("item[") && !segment.starts_with("variant[") && segment != "Optional" && segment != "Repeated" {
      return format!("the <{}> element", segment);
    }
  }

  "the element".to_string()
}

fn describe_location(path: &[String]) -> String {
  if path.is_empty() {
    return "at the root".to_string();
  }

  let mut elements: Vec<&str> = Vec::new();
  let mut context_parts: Vec<String> = Vec::new();

  for segment in path {
    if segment.starts_with("child[") || segment.starts_with("item[") || segment.starts_with("variant[") {
      continue;
    } else if segment == "Optional" {
      context_parts.push("inside a conditional block".to_string());
    } else if segment == "Repeated" {
      context_parts.push("inside a loop".to_string());
    } else {
      elements.push(segment);
    }
  }

  if elements.is_empty() && context_parts.is_empty() {
    return "at the root".to_string();
  }

  let mut result = String::new();

  if elements.len() == 1 {
    result = format!("in <{}>", elements[0]);
  } else if elements.len() >= 2 {
    let current = elements.last().unwrap();
    let parent = elements[elements.len() - 2];

    result = format!("in <{}> inside <{}>", current, parent);

    if elements.len() > 2 {
      let ancestors: Vec<String> = elements[..elements.len() - 2]
        .iter()
        .map(|element_name| format!("<{}>", element_name))
        .collect();
      result = format!("{} > {}", ancestors.join(" > "), result);
    }
  }

  if !context_parts.is_empty() {
    if result.is_empty() {
      result = context_parts.join(", ");
    } else {
      result = format!("{}, {}", result, context_parts.join(", "));
    }
  }

  result
}

fn parse_tag_value(source: &str) -> Option<&str> {
  let rest = source.strip_prefix("tag: ")?;

  if rest == "dynamic" {
    return Some("dynamic");
  }

  rest.strip_prefix('"')?.strip_suffix('"')
}

fn parse_attribute(source: &str) -> Option<(&str, &str)> {
  let rest = source.strip_prefix("attr: ")?;
  let colon_position = rest.find(": ")?;
  let name = &rest[..colon_position];
  let value = &rest[colon_position + 2..];

  Some((name, value))
}

fn parse_partial_ref(source: &str) -> Option<&str> {
  let rest = source.strip_prefix("PartialRef<\"")?;

  rest.strip_suffix("\">")
}

fn extract_number(source: &str) -> Option<usize> {
  source
    .split_whitespace()
    .filter_map(|word| word.trim_end_matches(|character: char| !character.is_ascii_digit()).parse::<usize>().ok())
    .next()
}

fn describe_shape_value(value: &str) -> String {
  if value == "Text" {
    return "text content".to_string();
  }

  if value == "Dynamic" {
    return "dynamic content".to_string();
  }

  if value == "Comment" {
    return "a comment".to_string();
  }

  if value == "Doctype" {
    return "a doctype declaration".to_string();
  }

  if value == "Empty" {
    return "empty content".to_string();
  }

  if let Some(rest) = value.strip_prefix("Element<") {
    if let Some(tag) = rest.strip_prefix('"') {
      if let Some(end) = tag.find('"') {
        let tag_name = &tag[..end];

        if rest.contains("children)") {
          return format!("a <{}> element (with children)", tag_name);
        }

        return format!("a <{}> element", tag_name);
      }
    }

    if rest.starts_with("dynamic") {
      return "a dynamically-tagged element".to_string();
    }
  }

  if let Some(rest) = value.strip_prefix("Optional<") {
    if let Some(inner) = rest.strip_suffix('>') {
      return format!("a conditional {}", describe_shape_value(inner));
    }
  }

  if let Some(rest) = value.strip_prefix("Repeated<") {
    if let Some(inner) = rest.strip_suffix('>') {
      return format!("a repeated {}", describe_shape_value(inner));
    }
  }

  if value.starts_with("Sequence(") {
    return "a sequence of elements".to_string();
  }

  if value.starts_with("Union(") {
    return "a set of conditional variants".to_string();
  }

  if let Some(name) = parse_partial_ref(value) {
    return format!("a reference to the `{}` partial", name);
  }

  value.to_string()
}
