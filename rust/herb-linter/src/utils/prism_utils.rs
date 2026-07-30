use herb::prism::PrismNode;

pub const DEBUG_OUTPUT_METHODS: &[&str] = &["p", "pp", "puts", "print", "warn", "debug", "byebug"];
pub const BINDING_DEBUGGER_METHODS: &[&str] = &["pry", "irb"];

pub const SIDE_EFFECT_METHODS: &[&str] = &[
  "content_for",
  "provide",
  "flush",
  "turbo_refreshes_with",
  "turbo_exempts_page_from_cache",
  "turbo_exempts_page_from_preview",
  "turbo_page_requires_reload",
];

pub const CONTROL_FLOW_METHODS: &[&str] = &["raise", "throw", "fail"];

const CONTROL_FLOW_NODE_TYPES: &[&str] = &["BreakNode", "NextNode", "RedoNode", "RetryNode", "ReturnNode"];

pub fn is_assignment_node(node: &PrismNode) -> bool {
  node.node_type.ends_with("WriteNode")
}

pub fn is_side_effect_call(node: &PrismNode) -> bool {
  if !node.is("CallNode") || node.receiver().is_some() {
    return false;
  }

  node.name.as_deref().map(|name| SIDE_EFFECT_METHODS.contains(&name)).unwrap_or(false)
}

pub fn is_control_flow_node(node: &PrismNode) -> bool {
  if CONTROL_FLOW_NODE_TYPES.contains(&node.node_type.as_str()) {
    return true;
  }

  if node.is("CallNode") && node.receiver().is_none() {
    return node.name.as_deref().map(|name| CONTROL_FLOW_METHODS.contains(&name)).unwrap_or(false);
  }

  false
}

pub fn unwrap_modifier_statement(node: &PrismNode) -> &PrismNode {
  if !matches!(node.node_type.as_str(), "IfNode" | "UnlessNode" | "WhileNode" | "UntilNode") {
    return node;
  }

  let statements = match node.children.iter().find(|child| child.is("StatementsNode")) {
    Some(statements) => statements,
    None => return node,
  };

  if statements.children.len() != 1 {
    return node;
  }

  &statements.children[0]
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
