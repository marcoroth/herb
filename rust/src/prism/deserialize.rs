use super::buffer::SerializationBuffer;
use super::PrismNode;

const MAJOR_VERSION: u8 = 2;
const MINOR_VERSION: u8 = 0;
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
  let mut stack: Vec<Option<PrismNode>> = Vec::new();

  while buffer.position() < pool {
    match buffer.read_byte() {
      0 => stack.push(None),
      255 => {
        buffer.read_bytes(8);
      }
      type_id => {
        let node = read_node(&mut buffer, type_id, pool, &mut stack);
        stack.push(Some(node));
      }
    }
  }

  if stack.len() != 1 {
    return None;
  }

  stack.pop().flatten()
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
  buffer.read_bytes(8); // checksum

  let line_offsets = buffer.read_var_int();
  for _ in 0..line_offsets {
    buffer.read_var_int();
  }

  let comments = buffer.read_var_int();
  for _ in 0..comments {
    buffer.read_var_int();
    buffer.read_location();
  }

  let attached_nodes = buffer.read_var_int();
  for _ in 0..attached_nodes {
    buffer.read_var_int();

    let attached_comments = buffer.read_var_int();
    for _ in 0..attached_comments {
      buffer.read_var_int();
    }
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

  buffer.read_byte(); // continuable

  let pool = buffer.read_uint32() as usize;
  buffer.read_var_int();

  Some((buffer, pool))
}

fn read_node(buffer: &mut SerializationBuffer, type_id: u8, pool: usize, stack: &mut Vec<Option<PrismNode>>) -> PrismNode {
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
  };

  read_node_body(buffer, type_id, pool, &mut node, stack);

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

struct PrismRecord {
  type_id: u8,
  offset: usize,
  children: Vec<Option<PrismRecord>>,
}

fn index_records(buffer: &mut SerializationBuffer, pool: usize) -> Option<PrismRecord> {
  let mut stack: Vec<Option<PrismRecord>> = Vec::new();

  while buffer.position() < pool {
    match buffer.read_byte() {
      0 => stack.push(None),
      255 => {
        buffer.read_bytes(8);
      }
      type_id => {
        let offset = buffer.position();

        buffer.read_var_int();
        buffer.read_location();

        let count = record_child_count(buffer, type_id, pool);
        let children = stack.split_off(stack.len().saturating_sub(count));

        stack.push(Some(PrismRecord { type_id, offset, children }));
      }
    }
  }

  if stack.len() != 1 {
    return None;
  }

  stack.pop().flatten()
}

fn prettyprint_record(record: PrismRecord, buffer: &mut SerializationBuffer, pool: usize, output: &mut String, prefix: &mut String, newlines: &[usize]) {
  let resume = buffer.position();
  buffer.set_position(record.offset);

  buffer.read_var_int();

  let (start_offset, length) = buffer.read_location();
  let mut children = record.children.into_iter();

  prettyprint_body(
    buffer,
    record.type_id,
    pool,
    output,
    prefix,
    start_offset,
    start_offset + length,
    newlines,
    &mut children,
  );

  buffer.set_position(resume);
}

/// pm_prettyprint
pub fn prettyprint(bytes: &[u8], source: &str) -> Option<String> {
  let (mut buffer, pool) = skip_header(SerializationBuffer::new(source.as_bytes(), bytes))?;
  let root = index_records(&mut buffer, pool)?;

  let newlines = newline_offsets(source);
  let mut output = String::new();
  let mut prefix = String::new();

  prettyprint_record(root, &mut buffer, pool, &mut output, &mut prefix, &newlines);

  Some(output)
}
