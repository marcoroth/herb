pub fn is_whitespace(character: char) -> bool {
  character.is_whitespace()
}

pub fn is_newline(character: char) -> bool {
  character == '\r' || character == '\n'
}

pub fn count_in_string(string: &str, character: char) -> usize {
  string.chars().filter(|&c| c == character).count()
}

pub fn count_newlines(string: &str) -> usize {
  count_in_string(string, '\n')
}

pub fn replace_char(string: &str, find: char, replace: char) -> String {
  string.replace(find, &replace.to_string())
}

pub fn escape_newlines(string: &str) -> String {
  string.replace('\n', "\\n")
}

pub fn wrap_string(string: &str, character: char) -> String {
  format!("{}{}{}", character, string, character)
}

pub fn quoted_string(string: &str) -> String {
  wrap_string(string, '"')
}

pub fn erbx_strdup(string: &str) -> String {
  string.to_string()
}
