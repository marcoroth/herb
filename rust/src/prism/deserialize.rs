use super::buffer::SerializationBuffer;
use super::PrismNode;

const MAJOR_VERSION: u8 = 1;
const MINOR_VERSION: u8 = 9;
const PATCH_VERSION: u8 = 0;

const _: () = assert!(
  MAJOR_VERSION as u32 == crate::bindings::PRISM_VERSION_MAJOR,
  "prism major version moved: re-check skip_header, then bump MAJOR_VERSION"
);
const _: () = assert!(
  MINOR_VERSION as u32 == crate::bindings::PRISM_VERSION_MINOR,
  "prism minor version moved: re-check skip_header, then bump MINOR_VERSION"
);
const _: () = assert!(
  PATCH_VERSION as u32 == crate::bindings::PRISM_VERSION_PATCH,
  "prism patch version moved: re-check skip_header, then bump PATCH_VERSION"
);

include!("generated_deserialize.rs");

pub fn deserialize(bytes: &[u8], source: &str) -> Option<PrismNode> {
  let (mut buffer, pool) = skip_header(SerializationBuffer::new(source.as_bytes(), bytes))?;

  Some(read_node(&mut buffer, pool))
}

fn skip_header(mut buffer: SerializationBuffer<'_>) -> Option<(SerializationBuffer<'_>, usize)> {
  if buffer.read_bytes(5) != b"PRISM" {
    return None;
  }

  if buffer.read_byte() != MAJOR_VERSION || buffer.read_byte() != MINOR_VERSION || buffer.read_byte() != PATCH_VERSION {
    return None;
  }

  if buffer.read_byte() != 0 {
    return None;
  }

  let encoding_length = buffer.read_var_int();
  buffer.read_bytes(encoding_length);

  buffer.read_var_int(); // start line

  let line_offsets = buffer.read_var_int();
  for _ in 0..line_offsets {
    buffer.read_var_int();
  }

  let comments = buffer.read_var_int();
  for _ in 0..comments {
    buffer.read_var_int();
    buffer.read_location();
  }

  let magic_comments = buffer.read_var_int();
  for _ in 0..magic_comments {
    buffer.read_location();
    buffer.read_location();
  }

  buffer.read_optional_location();

  for _ in 0..2 {
    let diagnostics = buffer.read_var_int();

    for _ in 0..diagnostics {
      buffer.read_var_int();
      let message_length = buffer.read_var_int();
      buffer.read_bytes(message_length);
      buffer.read_location();
      buffer.read_byte();
    }
  }

  let pool = buffer.read_uint32() as usize;
  buffer.read_var_int();

  Some((buffer, pool))
}

fn read_node(buffer: &mut SerializationBuffer, pool: usize) -> PrismNode {
  let type_id = buffer.read_byte();

  buffer.read_var_int(); // node id

  let (start_offset, length) = buffer.read_location();

  let mut node = PrismNode {
    node_type: node_type_name_for(type_id),
    start_offset,
    end_offset: start_offset + length,
    name: None,
    flags: 0,
    receiver_index: None,
    key: None,
    unescaped: None,
    has_block: false,
    children: Vec::new(),
    field_spans: Vec::new(),
    location_spans: Vec::new(),
  };

  read_node_body(buffer, type_id, pool, &mut node);

  node
}

include!("generated_prettyprint.rs");

fn location_string(start: usize, end: usize, newlines: &[usize]) -> String {
  let (start_line, start_column) = line_column(start, newlines);
  let (end_line, end_column) = line_column(end, newlines);

  format!("({start_line},{start_column})-({end_line},{end_column})")
}

fn line_column(offset: usize, newlines: &[usize]) -> (usize, usize) {
  let line = newlines.partition_point(|newline| *newline <= offset);
  let line_start = if line == 0 { 0 } else { newlines[line - 1] + 1 };

  (line, offset - line_start)
}

fn newline_offsets(source: &str) -> Vec<usize> {
  source.bytes().enumerate().filter(|(_, byte)| *byte == b'\n').map(|(index, _)| index).collect()
}

fn prettyprint_node(buffer: &mut SerializationBuffer, pool: usize, output: &mut String, prefix: &mut String, newlines: &[usize]) {
  let type_id = buffer.read_byte();

  buffer.read_var_int();

  let (start_offset, length) = buffer.read_location();

  prettyprint_body(buffer, type_id, pool, output, prefix, start_offset, start_offset + length, newlines);
}

/// pm_prettyprint
pub fn prettyprint(bytes: &[u8], source: &str) -> Option<String> {
  let (mut buffer, pool) = skip_header(SerializationBuffer::new(source.as_bytes(), bytes))?;

  let newlines = newline_offsets(source);
  let mut output = String::new();
  let mut prefix = String::new();

  prettyprint_node(&mut buffer, pool, &mut output, &mut prefix, &newlines);

  Some(output)
}
