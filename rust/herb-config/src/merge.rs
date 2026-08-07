use serde_yaml::Value;

pub fn deep_merge(target: &Value, source: &Value) -> Value {
  let (target_mapping, source_mapping) = match (target.as_mapping(), source.as_mapping()) {
    (Some(target_mapping), Some(source_mapping)) => (target_mapping, source_mapping),
    _ => return source.clone(),
  };

  let mut output = target_mapping.clone();

  for (key, source_value) in source_mapping {
    let target_value = target_mapping.get(key);

    if let Some(source_sequence) = source_value.as_sequence() {
      let is_pattern_key = matches!(key.as_str(), Some("include") | Some("exclude"));

      match target_value.and_then(Value::as_sequence) {
        Some(target_sequence) if is_pattern_key => {
          let mut merged = target_sequence.clone();
          merged.extend(source_sequence.iter().cloned());
          output.insert(key.clone(), Value::Sequence(merged));
        }

        _ => {
          output.insert(key.clone(), Value::Sequence(source_sequence.clone()));
        }
      }

      continue;
    }

    if source_value.is_mapping() && target_value.map(Value::is_mapping).unwrap_or(false) {
      output.insert(key.clone(), deep_merge(target_value.unwrap(), source_value));

      continue;
    }

    output.insert(key.clone(), source_value.clone());
  }

  Value::Mapping(output)
}

pub const ANCHOR_DEFINITION_PREFIX: &str = "x-";

pub fn strip_anchor_definitions(value: &mut Value) {
  if let Some(mapping) = value.as_mapping_mut() {
    mapping.retain(|key, _| !key.as_str().map(|key| key.starts_with(ANCHOR_DEFINITION_PREFIX)).unwrap_or(false));
  }
}
