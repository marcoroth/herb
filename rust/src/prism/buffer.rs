const FORCED_UTF8_ENCODING_FLAG: u32 = 1 << 2;
const FORCED_BINARY_ENCODING_FLAG: u32 = 1 << 3;

pub(crate) struct SerializationBuffer<'a> {
  source: &'a [u8],
  array: &'a [u8],
  index: usize,
}

impl<'a> SerializationBuffer<'a> {
  pub(crate) fn new(source: &'a [u8], array: &'a [u8]) -> Self {
    Self { source, array, index: 0 }
  }

  pub(crate) fn read_byte(&mut self) -> u8 {
    let byte = self.array.get(self.index).copied().unwrap_or(0);
    self.index += 1;
    byte
  }

  pub(crate) fn read_bytes(&mut self, length: usize) -> &'a [u8] {
    let start = self.index.min(self.array.len());
    let end = (self.index + length).min(self.array.len());
    self.index += length;
    &self.array[start..end]
  }

  pub(crate) fn read_var_int(&mut self) -> usize {
    let mut result: usize = 0;
    let mut shift: u32 = 0;

    loop {
      let byte = self.read_byte();
      result += ((byte & 0x7f) as usize) << shift;
      shift += 7;

      if byte & 0x80 == 0 {
        break;
      }
    }

    result
  }

  pub(crate) fn scan_uint32(&self, offset: usize) -> u32 {
    let mut bytes = [0u8; 4];

    for (index, byte) in bytes.iter_mut().enumerate() {
      *byte = self.array.get(offset + index).copied().unwrap_or(0);
    }

    u32::from_le_bytes(bytes)
  }

  pub(crate) fn read_uint32(&mut self) -> u32 {
    let value = self.scan_uint32(self.index);
    self.index += 4;
    value
  }

  pub(crate) fn read_double(&mut self) -> f64 {
    let mut bytes = [0u8; 8];

    for byte in bytes.iter_mut() {
      *byte = self.read_byte();
    }

    f64::from_le_bytes(bytes)
  }

  pub(crate) fn read_location(&mut self) -> (usize, usize) {
    (self.read_var_int(), self.read_var_int())
  }

  pub(crate) fn read_optional_location(&mut self) -> Option<(usize, usize)> {
    if self.read_byte() != 0 {
      Some(self.read_location())
    } else {
      None
    }
  }

  pub(crate) fn read_string_field(&mut self, flags: u32) -> String {
    match self.read_byte() {
      1 => {
        let start = self.read_var_int();
        let length = self.read_var_int();
        let end = (start + length).min(self.source.len());
        let start = start.min(end);

        decode(&self.source[start..end], flags)
      }

      2 => {
        let length = self.read_var_int();
        let bytes = self.read_bytes(length);

        decode(bytes, flags)
      }

      other => panic!("unknown serialized string type: {other}"),
    }
  }

  pub(crate) fn scan_constant(&self, constant_pool_offset: usize, constant_index: usize) -> String {
    let offset = constant_pool_offset + constant_index * 8;
    let mut start = self.scan_uint32(offset) as usize;
    let length = self.scan_uint32(offset + 4) as usize;

    let bytes = if start & (1 << 31) != 0 {
      start &= (1 << 31) - 1;
      let end = (start + length).min(self.array.len());
      &self.array[start.min(end)..end]
    } else {
      let end = (start + length).min(self.source.len());
      &self.source[start.min(end)..end]
    };

    String::from_utf8_lossy(bytes).into_owned()
  }
}

fn decode(bytes: &[u8], flags: u32) -> String {
  let _ = (FORCED_UTF8_ENCODING_FLAG, FORCED_BINARY_ENCODING_FLAG, flags);

  String::from_utf8_lossy(bytes).into_owned()
}

impl SerializationBuffer<'_> {
  pub(crate) fn peek_byte(&self) -> u8 {
    self.array.get(self.index).copied().unwrap_or(0)
  }

  pub(crate) fn read_required_constant(&mut self, pool: usize) -> String {
    let index = self.read_var_int();
    self.scan_constant(pool, index.saturating_sub(1))
  }

  pub(crate) fn read_optional_constant(&mut self, pool: usize) -> Option<String> {
    let index = self.read_var_int();

    if index == 0 {
      None
    } else {
      Some(self.scan_constant(pool, index - 1))
    }
  }

  pub(crate) fn read_integer(&mut self) {
    self.read_byte();
    let length = self.read_var_int();

    for _ in 0..length.max(1) {
      self.read_var_int();
    }
  }
}

impl SerializationBuffer<'_> {
  /// pm_integer_string
  pub(crate) fn read_integer_string(&mut self) -> String {
    let negative = self.read_byte() != 0;
    let length = self.read_var_int();

    let mut words: Vec<u128> = Vec::new();
    for _ in 0..length.max(1) {
      words.push(self.read_var_int() as u128);
    }

    let mut value: u128 = 0;
    for (index, word) in words.iter().enumerate() {
      value |= word << (index * 32);
    }

    if negative {
      format!("-{value}")
    } else {
      value.to_string()
    }
  }

  pub(crate) fn source_slice(&self, start: usize, length: usize) -> &[u8] {
    let end = (start + length).min(self.source.len());
    &self.source[start.min(end)..end]
  }
}

/// PM_BUFFER_ESCAPING_RUBY
pub(crate) fn escape_ruby(bytes: &[u8]) -> String {
  let mut output = String::new();

  for byte in bytes {
    match byte {
      b'"' => output.push_str("\\\""),
      b'\\' => output.push_str("\\\\"),
      b'\n' => output.push_str("\\n"),
      b'\r' => output.push_str("\\r"),
      b'\t' => output.push_str("\\t"),
      0x20..=0x7e => output.push(*byte as char),
      other => output.push_str(&format!("\\x{other:02X}")),
    }
  }

  output
}
