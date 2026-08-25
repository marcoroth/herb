pub const ANSI_ESCAPE: char = '\u{1b}';

pub fn ansi_sequence_at_start(text: &str) -> Option<&str> {
  let rest = text.strip_prefix("\x1b[")?;

  let length = rest.find(|character: char| !character.is_ascii_digit() && character != ';')?;

  if rest[length..].starts_with('m') {
    Some(&text[..2 + length + 1])
  } else {
    None
  }
}

pub fn find_ansi_sequences(text: &str) -> Vec<&str> {
  let mut sequences = Vec::new();
  let mut index = 0;

  while index < text.len() {
    match ansi_sequence_at_start(&text[index..]) {
      Some(sequence) => {
        sequences.push(sequence);
        index += sequence.len();
      }

      None => index += text[index..].chars().next().map_or(1, char::len_utf8),
    }
  }

  sequences
}

pub fn strip_ansi(text: &str) -> String {
  let mut stripped = String::with_capacity(text.len());
  let mut index = 0;

  while index < text.len() {
    match ansi_sequence_at_start(&text[index..]) {
      Some(sequence) => index += sequence.len(),

      None => {
        let character = text[index..].chars().next().unwrap_or('\0');

        stripped.push(character);
        index += character.len_utf8();
      }
    }
  }

  stripped
}

pub fn visible_width(text: &str) -> usize {
  let mut width = 0;
  let mut index = 0;

  while index < text.len() {
    match ansi_sequence_at_start(&text[index..]) {
      Some(sequence) => index += sequence.len(),

      None => {
        let character = text[index..].chars().next().unwrap_or('\0');

        width += 1;
        index += character.len_utf8();
      }
    }
  }

  width
}

pub fn split_capturing_ansi(text: &str) -> Vec<&str> {
  let mut parts = Vec::new();
  let mut start = 0;
  let mut index = 0;

  while index < text.len() {
    match ansi_sequence_at_start(&text[index..]) {
      Some(sequence) => {
        parts.push(&text[start..index]);
        parts.push(sequence);

        index += sequence.len();
        start = index;
      }

      None => index += text[index..].chars().next().map_or(1, char::len_utf8),
    }
  }

  parts.push(&text[start..]);

  parts
}
