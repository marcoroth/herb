use crate::bindings::*;

#[derive(Debug, Clone, PartialEq)]
pub struct PrismNode {
  pub node_type: String,
  pub start_offset: usize,
  pub end_offset: usize,
  pub name: Option<String>,
  receiver_index: Option<usize>,
  pub key: Option<Box<PrismNode>>,
  pub unescaped: Option<String>,
  pub has_block: bool,
  pub children: Vec<PrismNode>,
}

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
}

pub fn node_type_name(node_type: pm_node_type_t) -> String {
  let raw = unsafe { std::ffi::CStr::from_ptr(pm_node_type_to_str(node_type)) }.to_str().unwrap_or("");

  raw
    .strip_prefix("PM_")
    .unwrap_or(raw)
    .split('_')
    .map(|part| {
      let mut characters = part.chars();

      match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + &characters.as_str().to_lowercase(),
        None => String::new(),
      }
    })
    .collect()
}

struct ChildCollector {
  parser: *const pm_parser_t,
  children: Vec<PrismNode>,
  pointers: Vec<*const pm_node_t>,
}

unsafe extern "C" fn collect_child(node: *const pm_node_t, data: *mut std::ffi::c_void) -> bool {
  let collector = &mut *(data as *mut ChildCollector);

  if let Some(converted) = convert_node(node, collector.parser) {
    collector.children.push(converted);
    collector.pointers.push(node);
  }

  false
}

unsafe fn constant_name(parser: *const pm_parser_t, id: pm_constant_id_t) -> Option<String> {
  if id == 0 || parser.is_null() {
    return None;
  }

  let constant = pm_constant_pool_id_to_constant(&(*parser).constant_pool as *const _ as *mut _, id);

  if constant.is_null() || (*constant).start.is_null() {
    return None;
  }

  let bytes = std::slice::from_raw_parts((*constant).start, (*constant).length);

  Some(String::from_utf8_lossy(bytes).into_owned())
}

include!(concat!(env!("OUT_DIR"), "/prism_name_fields.rs"));

unsafe fn node_receiver_pointer(node: *const pm_node_t) -> Option<*const pm_node_t> {
  let receiver = match (*node).type_ as u32 {
    PM_CALL_NODE => (*(node as *const pm_call_node_t)).receiver,
    PM_CALL_AND_WRITE_NODE => (*(node as *const pm_call_and_write_node_t)).receiver,
    PM_CALL_OR_WRITE_NODE => (*(node as *const pm_call_or_write_node_t)).receiver,
    PM_CALL_OPERATOR_WRITE_NODE => (*(node as *const pm_call_operator_write_node_t)).receiver,
    _ => return None,
  };

  if receiver.is_null() {
    None
  } else {
    Some(receiver as *const pm_node_t)
  }
}

unsafe fn pm_string_value(string: &pm_string_t) -> Option<String> {
  if string.source.is_null() {
    return None;
  }

  let bytes = std::slice::from_raw_parts(string.source, string.length);

  Some(String::from_utf8_lossy(bytes).into_owned())
}

unsafe fn node_unescaped(node: *const pm_node_t) -> Option<String> {
  match (*node).type_ as u32 {
    PM_STRING_NODE => pm_string_value(&(*(node as *const pm_string_node_t)).unescaped),
    PM_SYMBOL_NODE => pm_string_value(&(*(node as *const pm_symbol_node_t)).unescaped),
    _ => None,
  }
}

unsafe fn node_has_block(node: *const pm_node_t) -> bool {
  match (*node).type_ as u32 {
    PM_CALL_NODE => !(*(node as *const pm_call_node_t)).block.is_null(),
    _ => false,
  }
}

unsafe fn node_key(node: *const pm_node_t, parser: *const pm_parser_t) -> Option<Box<PrismNode>> {
  if (*node).type_ as u32 != PM_ASSOC_NODE {
    return None;
  }

  let key = (*(node as *const pm_assoc_node_t)).key;

  if key.is_null() {
    return None;
  }

  convert_node(key, parser).map(Box::new)
}

pub unsafe fn convert_node(node: *const pm_node_t, parser: *const pm_parser_t) -> Option<PrismNode> {
  if node.is_null() {
    return None;
  }

  let mut collector = ChildCollector {
    parser,
    children: Vec::new(),
    pointers: Vec::new(),
  };

  pm_visit_child_nodes(node, Some(collect_child), &mut collector as *mut _ as *mut std::ffi::c_void);

  let start = (*node).location.start;
  let end = (*node).location.end;
  let base = (*parser).start;

  Some(PrismNode {
    node_type: node_type_name((*node).type_),
    start_offset: if base.is_null() || start.is_null() {
      0
    } else {
      start.offset_from(base) as usize
    },
    end_offset: if base.is_null() || end.is_null() { 0 } else { end.offset_from(base) as usize },
    name: node_name(node, parser),
    receiver_index: node_receiver_pointer(node).and_then(|receiver| collector.pointers.iter().position(|pointer| *pointer == receiver)),
    key: node_key(node, parser),
    unescaped: node_unescaped(node),
    has_block: node_has_block(node),
    children: collector.children,
  })
}

#[cfg(not(target_family = "wasm"))]
pub unsafe fn prettyprint(node: *const pm_node_t, parser: *const pm_parser_t) -> Option<String> {
  if node.is_null() || parser.is_null() {
    return None;
  }

  let mut buffer: pm_buffer_t = std::mem::zeroed();

  pm_prettyprint(&mut buffer, parser as *mut _, node);

  let output = if buffer.length > 0 && !buffer.value.is_null() {
    let bytes = std::slice::from_raw_parts(buffer.value as *const u8, buffer.length);
    Some(String::from_utf8_lossy(bytes).into_owned())
  } else {
    None
  };

  pm_buffer_free(&mut buffer);

  output
}

#[cfg(target_family = "wasm")]
pub unsafe fn prettyprint(_node: *const pm_node_t, _parser: *const pm_parser_t) -> Option<String> {
  None
}
