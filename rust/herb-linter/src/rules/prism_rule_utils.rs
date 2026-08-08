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

pub fn is_sleep_call(node: &PrismNode) -> bool {
  if !node.is("CallNode") {
    return false;
  }

  if node.name.as_deref() != Some("sleep") {
    return false;
  }

  match node.receiver() {
    None => true,
    Some(receiver) => receiver.is("ConstantReadNode") && receiver.name.as_deref() == Some("Kernel"),
  }
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

pub struct RenderPartialExpression<'node> {
  pub node: &'node PrismNode,
  pub explicit: bool,
}

pub fn call_arguments(call: &PrismNode) -> &[PrismNode] {
  match call.field_one("arguments") {
    Some(arguments) => arguments.field("arguments"),
    None => &[],
  }
}

pub fn render_partial_expression(call: &PrismNode) -> Option<RenderPartialExpression<'_>> {
  if !call.is("CallNode") {
    return None;
  }

  let arguments = call_arguments(call);
  let first = arguments.first()?;

  if let Some(named) = named_partial_argument(arguments) {
    return Some(RenderPartialExpression { node: named, explicit: true });
  }

  if first.is("KeywordHashNode") {
    return None;
  }

  Some(RenderPartialExpression { node: first, explicit: false })
}

fn named_partial_argument(arguments: &[PrismNode]) -> Option<&PrismNode> {
  for argument in arguments {
    if !argument.is("KeywordHashNode") {
      continue;
    }

    for element in argument.field("elements") {
      if !element.is("AssocNode") {
        continue;
      }

      let key = match element.field_one("key") {
        Some(key) if key.is("SymbolNode") => key,
        _ => continue,
      };

      if key.unescaped.as_deref() != Some("partial") {
        continue;
      }

      if let Some(value) = element.field_one("value") {
        return Some(value);
      }
    }
  }

  None
}

pub fn is_static_partial_path(node: &PrismNode) -> bool {
  if node.is("StringNode") {
    return true;
  }

  if node.is("IfNode") {
    return branches_of(node).iter().all(|branch| branch.is_some_and(is_static_partial_path));
  }

  false
}

fn branches_of(node: &PrismNode) -> Vec<Option<&PrismNode>> {
  let mut branches = vec![only_statement(node.field_one("statements"))];

  match node.field_one("subsequent") {
    None => branches.push(None),
    Some(subsequent) if subsequent.is("ElseNode") => branches.push(only_statement(subsequent.field_one("statements"))),
    Some(subsequent) => branches.push(Some(subsequent)),
  }

  branches
}

fn only_statement(statements: Option<&PrismNode>) -> Option<&PrismNode> {
  let statements = statements?;

  if !statements.is("StatementsNode") {
    return None;
  }

  match statements.field("body") {
    [only] => Some(only),
    _ => None,
  }
}

pub fn constructs_object(node: &PrismNode) -> bool {
  let mut current = Some(node);

  while let Some(node) = current {
    if node.is("CallNode") && node.name.as_deref() == Some("new") {
      return true;
    }

    current = node.receiver();
  }

  false
}
