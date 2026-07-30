use herb::prism::PrismNode;

pub const DEBUG_OUTPUT_METHODS: &[&str] = &["p", "pp", "puts", "print", "warn", "debug", "byebug"];
pub const BINDING_DEBUGGER_METHODS: &[&str] = &["pry", "irb"];

pub fn is_assignment_node(node: &PrismNode) -> bool {
  node.node_type.ends_with("WriteNode")
}

pub fn is_debug_output_call(node: &PrismNode) -> bool {
  let name = match node.name.as_deref() {
    Some(name) => name,
    None => return false,
  };

  if node.receiver().is_none() && DEBUG_OUTPUT_METHODS.contains(&name) {
    return true;
  }

  if BINDING_DEBUGGER_METHODS.contains(&name) {
    if let Some(receiver) = node.receiver() {
      return receiver.is("CallNode") && receiver.name.as_deref() == Some("binding") && receiver.receiver().is_none();
    }
  }

  false
}

pub fn is_call_on_local(node: &PrismNode, local_names: &[String]) -> bool {
  let root = node.root_receiver();

  let matches_local = |name: &Option<String>| name.as_ref().map(|name| local_names.contains(name)).unwrap_or(false);

  if root.is("LocalVariableReadNode") {
    return matches_local(&root.name);
  }

  if root.is("CallNode") && root.receiver().is_none() {
    return matches_local(&root.name);
  }

  false
}

pub fn walk_prism<F: FnMut(&PrismNode) -> bool>(node: &PrismNode, visit: &mut F) {
  if !visit(node) {
    return;
  }

  // `receiver` is also present in `children`, so only `children` is walked
  for child in &node.children {
    walk_prism(child, visit);
  }
}
