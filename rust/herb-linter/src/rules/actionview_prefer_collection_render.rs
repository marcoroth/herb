use herb::nodes::{AnyNode, ERBIterationBlockNode, ERBRenderNode};
use herb::Visitor;

rule_visitor!(PreferCollectionRenderVisitor);
define_parser_rule!(
  ActionViewPreferCollectionRenderRule,
  "actionview-prefer-collection-render",
  Error,
  PreferCollectionRenderVisitor,
  parser_options: { iteration_nodes: true, render_nodes: true },
  introduced_in: "unreleased"
);

fn single_block_argument_name(node: &ERBIterationBlockNode) -> Option<&str> {
  if node.block_arguments.len() != 1 {
    return None;
  }

  match &node.block_arguments[0] {
    AnyNode::RubyParameterNode(parameter) if parameter.kind == "positional" => parameter.name.as_ref().map(|token| token.value.as_str()),
    _ => None,
  }
}

fn single_render_node_in_body(node: &ERBIterationBlockNode) -> Option<&ERBRenderNode> {
  let mut body = node.body.iter().filter(|child| !is_whitespace_only_text(child));

  let child = body.next()?;

  if body.next().is_some() {
    return None;
  }

  match child {
    AnyNode::ERBRenderNode(render) if is_erb_output_render(render) => Some(render),
    _ => None,
  }
}

fn is_whitespace_only_text(node: &AnyNode) -> bool {
  match node {
    AnyNode::HTMLTextNode(text) => text.content.trim().is_empty(),
    _ => false,
  }
}

fn is_erb_output_render(node: &ERBRenderNode) -> bool {
  node
    .tag_opening
    .as_ref()
    .map(|token| token.value == "<%=" || token.value == "<%==")
    .unwrap_or(false)
}

fn collection_local_name_for(partial: &str) -> &str {
  let name = partial.rsplit('/').next().unwrap_or(partial);

  name.strip_prefix('_').unwrap_or(name)
}

fn collection_render_for(render: &ERBRenderNode, receiver: &str, block_argument: &str) -> Option<String> {
  let keywords = render.keywords.as_ref()?;

  if keywords.object.as_ref().map(|token| token.value.as_str()) == Some(block_argument) {
    return Some(format!("<%= render {receiver} %>"));
  }

  let partial = keywords.partial.as_ref().map(|token| token.value.as_str())?;

  if keywords.locals.len() != 1 {
    return None;
  }

  let local = match &keywords.locals[0] {
    AnyNode::RubyRenderLocalNode(local) => local,
    _ => return None,
  };

  if local.value.as_ref().map(|value| value.content.as_str()) != Some(block_argument) {
    return None;
  }

  let local_name = local.name.as_ref().map(|token| token.value.as_str())?;
  let as_name = if local_name == collection_local_name_for(partial) {
    String::new()
  } else {
    format!(", as: :{local_name}")
  };

  Some(format!("<%= render partial: \"{partial}\", collection: {receiver}{as_name} %>"))
}

impl Visitor for PreferCollectionRenderVisitor {
  fn visit_erb_iteration_block_node(&mut self, node: &ERBIterationBlockNode) {
    if let Some(suggestion) = suggestion_for(node) {
      self.add_offense(
        format!("Prefer `{suggestion}` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item."),
        node.location.clone(),
      );
    }

    self.walk_erb_iteration_block_node(node);
  }
}

fn suggestion_for(node: &ERBIterationBlockNode) -> Option<String> {
  if node.message.as_ref().map(|token| token.value.as_str()) != Some("each") {
    return None;
  }

  let receiver = node.receiver.as_ref().map(|token| token.value.as_str())?;
  let block_argument = single_block_argument_name(node)?;
  let render = single_render_node_in_body(node)?;

  collection_render_for(render, receiver, block_argument)
}
