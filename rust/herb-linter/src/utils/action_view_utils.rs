use herb::prism::PrismNode;

fn is_action_view_helper_name(name: &str) -> bool {
  herb::action_view_helpers::entries().iter().any(|entry| {
    if entry.output != "html" || entry.visibility != "public" || entry.name == "tag" {
      return false;
    }

    entry.name == name || entry.aliases.contains(&name)
  })
}

pub fn is_tag_builder_call(node: &PrismNode) -> bool {
  if !node.is("CallNode") {
    return false;
  }

  match node.receiver() {
    Some(receiver) => receiver.is("CallNode") && receiver.name.as_deref() == Some("tag") && receiver.receiver().is_none(),
    None => false,
  }
}

pub fn is_action_view_helper_call(node: &PrismNode) -> Option<String> {
  if !node.is("CallNode") {
    return None;
  }

  if is_tag_builder_call(node) {
    return Some("tag".to_string());
  }

  match (node.receiver(), &node.name) {
    (None, Some(name)) if is_action_view_helper_name(name) => Some(name.clone()),
    _ => None,
  }
}

/// `tag.attributes(...)`
pub fn is_tag_attributes_call(node: &PrismNode) -> bool {
  if !node.is("CallNode") || node.name.as_deref() != Some("attributes") {
    return false;
  }

  match node.receiver() {
    Some(receiver) => receiver.is("CallNode") && receiver.name.as_deref() == Some("tag"),
    None => false,
  }
}

/// `tag.attributes(...) if x` or `x && tag.attributes(...)`
pub fn is_conditional_tag_attributes_call(node: &PrismNode) -> bool {
  if node.is("IfNode") || node.is("UnlessNode") {
    let statements = match node.children.iter().find(|child| child.is("StatementsNode")) {
      Some(statements) => statements,
      None => return false,
    };

    if statements.children.len() != 1 {
      return false;
    }

    return is_tag_attributes_call(&statements.children[0]);
  }

  if node.is("AndNode") || node.is("OrNode") {
    return node.children.last().map(is_tag_attributes_call).unwrap_or(false);
  }

  false
}
