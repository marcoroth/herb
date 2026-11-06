#[cfg(feature = "prism")]
pub(crate) mod buffer;
#[cfg(feature = "prism")]
mod deserialize;

use crate::bindings::*;

#[cfg(feature = "prism")]
pub use deserialize::{deserialize, prettyprint};

#[cfg(feature = "prism")]
#[derive(Debug, Clone, PartialEq)]
pub struct PrismNode {
  pub node_type: String,
  pub start_offset: usize,
  pub end_offset: usize,
  pub flags: u32,
  pub name: Option<String>,
  pub(crate) receiver_index: Option<usize>,
  pub key: Option<Box<PrismNode>>,
  pub unescaped: Option<String>,
  pub has_block: bool,
  pub children: Vec<PrismNode>,
}

#[cfg(feature = "prism")]
impl PrismNode {
  pub fn is(&self, node_type: &str) -> bool {
    self.node_type == node_type
  }

  pub fn receiver(&self) -> Option<&PrismNode> {
    self.receiver_index.map(|index| &self.children[index])
  }

  pub fn root_receiver(&self) -> &PrismNode {
    let mut current = self;

    while let Some(receiver) = current.receiver() {
      current = receiver;
    }

    current
  }

  pub fn tree_inspect(&self) -> String {
    let mut output = String::new();
    self.inspect_into(&mut output, "", true);
    output
  }

  fn inspect_into(&self, output: &mut String, prefix: &str, is_last: bool) {
    let branch = if is_last { "└── " } else { "├── " };

    output.push_str(prefix);
    output.push_str(branch);
    output.push_str(&format!("@ {} ({},{})", self.node_type, self.start_offset, self.end_offset));

    if let Some(ref name) = self.name {
      output.push_str(&format!(" name: :{name}"));
    }

    if let Some(ref unescaped) = self.unescaped {
      output.push_str(&format!(" unescaped: {unescaped:?}"));
    }

    if self.flags != 0 {
      output.push_str(&format!(" flags: {:#x}", self.flags));
    }

    if self.has_block {
      output.push_str(" block");
    }

    output.push('\n');

    let child_prefix = format!("{prefix}{}", if is_last { "    " } else { "│   " });

    for (index, child) in self.children.iter().enumerate() {
      child.inspect_into(output, &child_prefix, index == self.children.len() - 1);
    }
  }
}

/// # Safety
///
/// `prism_node` must either have null pointers or point at a live prism node
/// and the parser that produced it. The pointers are only read for the
/// duration of the call.
pub unsafe fn serialize(prism_node: herb_prism_node_T) -> Option<Vec<u8>> {
  if prism_node.node.is_null() || prism_node.parser.is_null() {
    return None;
  }

  let buffer = pm_buffer_new();

  herb_prism_node_serialize(prism_node, buffer);

  let value = pm_buffer_value(buffer);
  let length = pm_buffer_length(buffer);

  let output = if length > 0 && !value.is_null() {
    Some(std::slice::from_raw_parts(value as *const u8, length).to_vec())
  } else {
    None
  };

  pm_buffer_free(buffer);

  output
}
