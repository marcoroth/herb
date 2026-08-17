use herb::location::Location;

use super::named_reference::NamedReference;

pub struct OffsetTable {
  line_starts: Vec<usize>,
}

impl OffsetTable {
  pub fn new(source: &str) -> Self {
    let mut line_starts = vec![0];

    for (index, byte) in source.bytes().enumerate() {
      if byte == b'\n' {
        line_starts.push(index + 1);
      }
    }

    Self { line_starts }
  }

  pub fn location_for(&self, reference: &NamedReference) -> Location {
    let (start_line, start_column) = self.position_at(reference.start_offset);
    let (end_line, end_column) = self.position_at(reference.start_offset + reference.length);

    Location::from(start_line as u32, start_column as u32, end_line as u32, end_column as u32)
  }

  pub fn position_at(&self, offset: usize) -> (usize, usize) {
    let following = self.line_starts.partition_point(|start| *start <= offset);
    let index = following.saturating_sub(1);
    let start = self.line_starts.get(index).copied().unwrap_or(0);

    (index + 1, offset - start)
  }
}
