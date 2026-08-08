pub fn has_balanced_parentheses(content: &str) -> bool {
  let mut depth: i32 = 0;

  for character in content.chars() {
    if character == '(' {
      depth += 1;
    }

    if character == ')' {
      depth -= 1;
    }

    if depth < 0 {
      return false;
    }
  }

  depth == 0
}

pub fn split_by_top_level_comma(string: &str) -> Vec<&str> {
  let mut result = Vec::new();
  let mut start = 0;
  let mut paren_depth = 0i32;
  let mut bracket_depth = 0i32;
  let mut brace_depth = 0i32;
  let mut in_string = false;
  let mut string_char = ' ';
  let bytes = string.as_bytes();

  for index in 0..bytes.len() {
    let character = bytes[index] as char;
    let previous_character = if index > 0 { bytes[index - 1] as char } else { '\0' };

    if (character == '"' || character == '\'') && previous_character != '\\' {
      if !in_string {
        in_string = true;
        string_char = character;
      } else if character == string_char {
        in_string = false;
      }
    }

    if !in_string {
      match character {
        '(' => paren_depth += 1,
        ')' => paren_depth -= 1,
        '[' => bracket_depth += 1,
        ']' => bracket_depth -= 1,
        '{' => brace_depth += 1,
        '}' => brace_depth -= 1,
        ',' if paren_depth == 0 && bracket_depth == 0 && brace_depth == 0 => {
          result.push(&string[start..index]);
          start = index + 1;
          continue;
        }
        _ => {}
      }
    }
  }

  if start < string.len() {
    result.push(&string[start..]);
  }

  result
}
