use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
  Context,
  Added,
  Removed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiffLine {
  #[serde(rename = "type")]
  pub line_type: DiffLineType,
  pub content: String,
  #[serde(rename = "oldLineNumber")]
  pub old_line_number: Option<usize>,
  #[serde(rename = "newLineNumber")]
  pub new_line_number: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiffHunk {
  #[serde(rename = "oldStart")]
  pub old_start: usize,
  #[serde(rename = "oldCount")]
  pub old_count: usize,
  #[serde(rename = "newStart")]
  pub new_start: usize,
  #[serde(rename = "newCount")]
  pub new_count: usize,
  pub lines: Vec<DiffLine>,
}

const MAX_LCS_LINES: usize = 2000;

const MAX_INLINE_REFINE_LENGTH: usize = 500;

const INLINE_SPAN_MERGE_GAP: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InlineRange {
  pub start: usize,
  pub end: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct InlineRanges {
  pub removed: Vec<InlineRange>,
  pub added: Vec<InlineRange>,
}

#[derive(Debug, Clone, Copy)]
struct Operation {
  operation_type: DiffLineType,
  old_index: Option<usize>,
  new_index: Option<usize>,
}

fn common_prefix_length<T: PartialEq>(original: &[T], modified: &[T]) -> usize {
  let mut length = 0;

  while length < original.len() && length < modified.len() && original[length] == modified[length] {
    length += 1;
  }

  length
}

fn common_suffix_length<T: PartialEq>(original: &[T], modified: &[T], prefix_length: usize) -> usize {
  let mut length = 0;

  while length < original.len() - prefix_length
    && length < modified.len() - prefix_length
    && original[original.len() - 1 - length] == modified[modified.len() - 1 - length]
  {
    length += 1;
  }

  length
}

fn lcs_operations<T: PartialEq>(original: &[T], modified: &[T]) -> Vec<Operation> {
  let rows = original.len();
  let columns = modified.len();

  let stride = columns + 1;
  let mut lengths = vec![0usize; (rows + 1) * stride];

  for row in (0..rows).rev() {
    for column in (0..columns).rev() {
      lengths[row * stride + column] = if original[row] == modified[column] {
        lengths[(row + 1) * stride + column + 1] + 1
      } else {
        lengths[(row + 1) * stride + column].max(lengths[row * stride + column + 1])
      };
    }
  }

  let mut operations: Vec<Operation> = Vec::new();

  let mut row = 0;
  let mut column = 0;

  while row < rows && column < columns {
    if original[row] == modified[column] {
      operations.push(Operation {
        operation_type: DiffLineType::Context,
        old_index: Some(row),
        new_index: Some(column),
      });

      row += 1;
      column += 1;
    } else if lengths[(row + 1) * stride + column] >= lengths[row * stride + column + 1] {
      operations.push(Operation {
        operation_type: DiffLineType::Removed,
        old_index: Some(row),
        new_index: None,
      });

      row += 1;
    } else {
      operations.push(Operation {
        operation_type: DiffLineType::Added,
        old_index: None,
        new_index: Some(column),
      });

      column += 1;
    }
  }

  while row < rows {
    operations.push(Operation {
      operation_type: DiffLineType::Removed,
      old_index: Some(row),
      new_index: None,
    });

    row += 1;
  }

  while column < columns {
    operations.push(Operation {
      operation_type: DiffLineType::Added,
      old_index: None,
      new_index: Some(column),
    });

    column += 1;
  }

  operations
}

fn trimmed_operations<T: PartialEq>(original: &[T], modified: &[T]) -> Vec<Operation> {
  let prefix_length = common_prefix_length(original, modified);
  let suffix_length = common_suffix_length(original, modified, prefix_length);

  let mut operations: Vec<Operation> = Vec::new();

  for index in 0..prefix_length {
    operations.push(Operation {
      operation_type: DiffLineType::Context,
      old_index: Some(index),
      new_index: Some(index),
    });
  }

  for index in prefix_length..original.len() - suffix_length {
    operations.push(Operation {
      operation_type: DiffLineType::Removed,
      old_index: Some(index),
      new_index: None,
    });
  }

  for index in prefix_length..modified.len() - suffix_length {
    operations.push(Operation {
      operation_type: DiffLineType::Added,
      old_index: None,
      new_index: Some(index),
    });
  }

  for index in 0..suffix_length {
    operations.push(Operation {
      operation_type: DiffLineType::Context,
      old_index: Some(original.len() - suffix_length + index),
      new_index: Some(modified.len() - suffix_length + index),
    });
  }

  operations
}

pub fn compute_diff_hunks(original: &str, modified: &str, context_lines: usize) -> Vec<DiffHunk> {
  if original == modified {
    return Vec::new();
  }

  let original_lines: Vec<&str> = original.split('\n').collect();
  let modified_lines: Vec<&str> = modified.split('\n').collect();

  let use_lcs = original_lines.len() <= MAX_LCS_LINES && modified_lines.len() <= MAX_LCS_LINES;

  let operations = if use_lcs {
    lcs_operations(&original_lines, &modified_lines)
  } else {
    trimmed_operations(&original_lines, &modified_lines)
  };

  let changed_indices: Vec<usize> = operations
    .iter()
    .enumerate()
    .filter(|(_, operation)| operation.operation_type != DiffLineType::Context)
    .map(|(index, _)| index)
    .collect();

  if changed_indices.is_empty() {
    return Vec::new();
  }

  let mut groups: Vec<Vec<usize>> = vec![vec![changed_indices[0]]];

  for index in 1..changed_indices.len() {
    let gap = changed_indices[index] - changed_indices[index - 1] - 1;

    if gap <= context_lines * 2 {
      groups.last_mut().expect("groups is never empty").push(changed_indices[index]);
    } else {
      groups.push(vec![changed_indices[index]]);
    }
  }

  groups
    .into_iter()
    .map(|group| {
      let first = group[0].saturating_sub(context_lines);
      let last = (operations.len() - 1).min(group[group.len() - 1] + context_lines);

      let mut lines: Vec<DiffLine> = Vec::new();

      let mut old_start = 0;
      let mut new_start = 0;
      let mut old_count = 0;
      let mut new_count = 0;

      for operation in operations.iter().take(last + 1).skip(first) {
        let old_line_number = operation.old_index.map(|index| index + 1);
        let new_line_number = operation.new_index.map(|index| index + 1);

        if let Some(number) = old_line_number {
          if old_start == 0 {
            old_start = number;
          }

          old_count += 1;
        }

        if let Some(number) = new_line_number {
          if new_start == 0 {
            new_start = number;
          }

          new_count += 1;
        }

        let content = if operation.operation_type == DiffLineType::Added {
          modified_lines[operation.new_index.expect("added lines carry a new index")].to_string()
        } else {
          original_lines[operation.old_index.expect("context and removed lines carry an old index")].to_string()
        };

        lines.push(DiffLine {
          line_type: operation.operation_type,
          content,
          old_line_number,
          new_line_number,
        });
      }

      DiffHunk {
        old_start,
        old_count,
        new_start,
        new_count,
        lines,
      }
    })
    .collect()
}

fn merge_ranges(indices: &[usize]) -> Vec<InlineRange> {
  if indices.is_empty() {
    return Vec::new();
  }

  let mut ranges: Vec<InlineRange> = vec![InlineRange {
    start: indices[0],
    end: indices[0] + 1,
  }];

  for index in indices.iter().skip(1).copied() {
    let last = ranges.last_mut().expect("ranges is never empty");

    if index - last.end <= INLINE_SPAN_MERGE_GAP {
      last.end = index + 1;
    } else {
      ranges.push(InlineRange { start: index, end: index + 1 });
    }
  }

  ranges
}

pub fn compute_inline_ranges(before: &str, after: &str) -> InlineRanges {
  let empty = InlineRanges::default();

  if before == after {
    return empty;
  }

  let before_characters: Vec<char> = before.chars().collect();
  let after_characters: Vec<char> = after.chars().collect();

  if before_characters.len() > MAX_INLINE_REFINE_LENGTH || after_characters.len() > MAX_INLINE_REFINE_LENGTH {
    return empty;
  }

  let operations = lcs_operations(&before_characters, &after_characters);

  let shared_length = operations.iter().filter(|operation| operation.operation_type == DiffLineType::Context).count();
  let longest_length = before_characters.len().max(after_characters.len());

  if shared_length == 0 || shared_length * 4 < longest_length {
    return empty;
  }

  let removed_indices: Vec<usize> = operations
    .iter()
    .filter(|operation| operation.operation_type == DiffLineType::Removed)
    .filter_map(|operation| operation.old_index)
    .collect();

  let added_indices: Vec<usize> = operations
    .iter()
    .filter(|operation| operation.operation_type == DiffLineType::Added)
    .filter_map(|operation| operation.new_index)
    .collect();

  InlineRanges {
    removed: merge_ranges(&removed_indices),
    added: merge_ranges(&added_indices),
  }
}
