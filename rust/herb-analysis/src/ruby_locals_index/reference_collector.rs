use herb::prism::PrismNode;

use super::named_reference::NamedReference;

const LOCAL_VARIABLE_READ: &str = "LocalVariableReadNode";
const CALL_NODE: &str = "CallNode";
const REQUIRED_PARAMETER: &str = "RequiredParameterNode";
const OPTIONAL_PARAMETER: &str = "OptionalParameterNode";
const BLOCK_PARAMETER: &str = "BlockParameterNode";
const REST_PARAMETER: &str = "RestParameterNode";
const LOCAL_VARIABLE_TARGET: &str = "LocalVariableTargetNode";

const LOCAL_WRITE_NODES: [&str; 4] = [
  "LocalVariableWriteNode",
  "LocalVariableAndWriteNode",
  "LocalVariableOrWriteNode",
  "LocalVariableOperatorWriteNode",
];

const SIGIL_PARAMETERS: [&str; 2] = [BLOCK_PARAMETER, REST_PARAMETER];

#[derive(Debug, Default)]
pub struct ReferenceCollector {
  pub local_reads: Vec<NamedReference>,
  pub bare_calls: Vec<NamedReference>,
  pub parameters: Vec<NamedReference>,
  pub assignments: Vec<NamedReference>,
}

impl ReferenceCollector {
  pub fn new(program: &PrismNode) -> Self {
    let mut collector = Self::default();
    collector.walk(program);

    collector
  }

  fn walk(&mut self, node: &PrismNode) {
    self.record(node);

    for child in &node.children {
      self.walk(child);
    }
  }

  fn record(&mut self, node: &PrismNode) {
    self.record_read(node);
    self.record_binding(node);
  }

  fn record_read(&mut self, node: &PrismNode) {
    if node.is(LOCAL_VARIABLE_READ) {
      if let Some(reference) = whole_node(node) {
        self.local_reads.push(reference);
      }
    } else if node.is(CALL_NODE) && bare_call(node) {
      if let Some(reference) = whole_node(node) {
        self.bare_calls.push(reference);
      }
    }
  }

  fn record_binding(&mut self, node: &PrismNode) {
    if node.is(REQUIRED_PARAMETER) || node.is(LOCAL_VARIABLE_TARGET) {
      if let Some(reference) = whole_node(node) {
        self.parameters_or_assignments(node, reference);
      }

      return;
    }

    if node.is(OPTIONAL_PARAMETER) || SIGIL_PARAMETERS.contains(&node.node_type.as_str()) || LOCAL_WRITE_NODES.contains(&node.node_type.as_str()) {
      let Some(name) = node.name.clone() else {
        return;
      };

      let offset = if SIGIL_PARAMETERS.contains(&node.node_type.as_str()) {
        node.start_offset + 1
      } else {
        node.start_offset
      };

      let length = name.len();
      let reference = NamedReference::new(name, offset, length);

      self.parameters_or_assignments(node, reference);
    }
  }

  fn parameters_or_assignments(&mut self, node: &PrismNode, reference: NamedReference) {
    if node.is(LOCAL_VARIABLE_TARGET) || LOCAL_WRITE_NODES.contains(&node.node_type.as_str()) {
      self.assignments.push(reference);
    } else {
      self.parameters.push(reference);
    }
  }
}

fn whole_node(node: &PrismNode) -> Option<NamedReference> {
  let name = node.name.clone()?;
  let length = name.len();

  Some(NamedReference::new(name, node.start_offset, length))
}

fn bare_call(node: &PrismNode) -> bool {
  node.receiver().is_none() && !node.has_block && node.children.is_empty() && !node.name.as_ref().is_some_and(|name| name.ends_with('='))
}
