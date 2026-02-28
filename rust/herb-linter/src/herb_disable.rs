use herb::Location;

pub struct HerbDisableRuleName {
  pub name: String,
  pub offset: usize,
  pub length: usize,
}

impl HerbDisableRuleName {
  pub fn location(&self, content_location: &Location) -> Option<Location> {
    let start_line = content_location.start.line;
    let start_column = content_location.start.column + self.offset as u32;

    Some(Location::from(start_line, start_column, start_line, start_column + self.length as u32))
  }
}

pub struct HerbDisableComment {
  pub rule_names: Vec<String>,
  pub rule_name_details: Vec<HerbDisableRuleName>,
  pub rules_string: String,
}

const HERB_DISABLE_PREFIX: &str = "herb:disable";

pub fn parse_herb_disable_content(content: &str) -> Option<HerbDisableComment> {
  let trimmed = content.trim();

  if !trimmed.starts_with(HERB_DISABLE_PREFIX) {
    return None;
  }

  let after_prefix = trimmed[HERB_DISABLE_PREFIX.len()..].trim_start();
  if after_prefix.is_empty() {
    return None;
  }

  let rules_string = after_prefix.trim_end();
  let rule_names: Vec<String> = rules_string.split(',').map(|name| name.trim().to_string()).collect();

  if rule_names.iter().any(|name| name.is_empty()) {
    return None;
  }

  if rule_names.is_empty() {
    return None;
  }

  let herb_disable_prefix_pos = content.find(HERB_DISABLE_PREFIX)?;
  let search_start = herb_disable_prefix_pos + HERB_DISABLE_PREFIX.len();
  let rules_string_offset = content[search_start..].find(rules_string)? + search_start;

  let mut rule_name_details = Vec::new();
  let mut current_offset = 0;

  for rule_name in &rule_names {
    let rule_offset = rules_string[current_offset..].find(rule_name.as_str())? + current_offset;

    rule_name_details.push(HerbDisableRuleName {
      name: rule_name.clone(),
      offset: rules_string_offset + rule_offset,
      length: rule_name.len(),
    });

    current_offset = rule_offset + rule_name.len();
  }

  Some(HerbDisableComment {
    rule_names,
    rule_name_details,
    rules_string: rules_string.to_string(),
  })
}

pub fn parse_herb_disable_line(line: &str) -> Option<HerbDisableComment> {
  let start_tag = "<%#";
  let end_tag = "%>";

  let start_index = line.find(start_tag)?;
  let end_index = line[start_index..].find(end_tag)? + start_index;
  let content = line[start_index + start_tag.len()..end_index].trim();

  if !content.starts_with(HERB_DISABLE_PREFIX) {
    return None;
  }

  let after_prefix = content[HERB_DISABLE_PREFIX.len()..].trim_start();

  if after_prefix.is_empty() {
    return None;
  }

  let rules_string = after_prefix.trim_end();
  let rule_names: Vec<String> = rules_string.split(',').map(|name| name.trim().to_string()).collect();

  if rule_names.iter().any(|name| name.is_empty()) {
    return None;
  }

  if rule_names.is_empty() {
    return None;
  }

  let herb_disable_prefix_pos = line.find(HERB_DISABLE_PREFIX)?;
  let search_start = herb_disable_prefix_pos + HERB_DISABLE_PREFIX.len();
  let rules_string_offset = line[search_start..].find(rules_string)? + search_start;

  let mut rule_name_details = Vec::new();
  let mut current_offset = 0;

  for rule_name in &rule_names {
    let rule_offset = rules_string[current_offset..].find(rule_name.as_str())? + current_offset;

    rule_name_details.push(HerbDisableRuleName {
      name: rule_name.clone(),
      offset: rules_string_offset + rule_offset,
      length: rule_name.len(),
    });

    current_offset = rule_offset + rule_name.len();
  }

  Some(HerbDisableComment {
    rule_names,
    rule_name_details,
    rules_string: rules_string.to_string(),
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_content_single_rule() {
    let result = parse_herb_disable_content(" herb:disable rule1 ").unwrap();
    assert_eq!(result.rule_names, vec!["rule1"]);
    assert_eq!(result.rules_string, "rule1");
    assert_eq!(result.rule_name_details.len(), 1);
    assert_eq!(result.rule_name_details[0].name, "rule1");
  }

  #[test]
  fn test_parse_content_multiple_rules() {
    let result = parse_herb_disable_content(" herb:disable rule1, rule2 ").unwrap();
    assert_eq!(result.rule_names, vec!["rule1", "rule2"]);
    assert_eq!(result.rules_string, "rule1, rule2");
  }

  #[test]
  fn test_parse_content_all() {
    let result = parse_herb_disable_content(" herb:disable all ").unwrap();
    assert_eq!(result.rule_names, vec!["all"]);
  }

  #[test]
  fn test_parse_content_no_rules() {
    assert!(parse_herb_disable_content(" herb:disable ").is_none());
  }

  #[test]
  fn test_parse_content_not_herb_disable() {
    assert!(parse_herb_disable_content(" some comment ").is_none());
  }

  #[test]
  fn test_parse_content_trailing_comma() {
    assert!(parse_herb_disable_content(" herb:disable rule1, ").is_none());
  }

  #[test]
  fn test_parse_content_consecutive_commas() {
    assert!(parse_herb_disable_content(" herb:disable rule1,, rule2 ").is_none());
  }

  #[test]
  fn test_parse_line_basic() {
    let result = parse_herb_disable_line("<div>test</div> <%# herb:disable rule1, rule2 %>").unwrap();
    assert_eq!(result.rule_names, vec!["rule1", "rule2"]);
  }

  #[test]
  fn test_parse_line_no_comment() {
    assert!(parse_herb_disable_line("<div>test</div>").is_none());
  }

  #[test]
  fn test_parse_line_not_herb_disable() {
    assert!(parse_herb_disable_line("<%# some comment %>").is_none());
  }
}
