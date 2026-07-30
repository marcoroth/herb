use herb::nodes::AnyNode;
use herb::Location;

pub fn get_commented_tag_prefix(content: &str) -> Option<&'static str> {
  for prefix in ["graphql", "%=", "==", "%", "=", "-"] {
    if content.starts_with(prefix) {
      return Some(prefix);
    }
  }

  None
}

pub fn as_erb_node(node: &AnyNode) -> Option<(&str, &str, &Location)> {
  macro_rules! erb {
    ($node:ident) => {
      Some((
        $node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or(""),
        $node.content.as_ref().map(|token| token.value.as_str()).unwrap_or(""),
        &$node.location,
      ))
    };
  }

  match node {
    AnyNode::ERBOpenTagNode(node) => erb!(node),
    AnyNode::ERBContentNode(node) => erb!(node),
    AnyNode::ERBEndNode(node) => erb!(node),
    AnyNode::ERBElseNode(node) => erb!(node),
    AnyNode::ERBIfNode(node) => erb!(node),
    AnyNode::ERBBlockNode(node) => erb!(node),
    AnyNode::ERBWhenNode(node) => erb!(node),
    AnyNode::ERBInNode(node) => erb!(node),
    AnyNode::ERBCaseNode(node) => erb!(node),
    AnyNode::ERBCaseMatchNode(node) => erb!(node),
    AnyNode::ERBWhileNode(node) => erb!(node),
    AnyNode::ERBUntilNode(node) => erb!(node),
    AnyNode::ERBForNode(node) => erb!(node),
    AnyNode::ERBRescueNode(node) => erb!(node),
    AnyNode::ERBEnsureNode(node) => erb!(node),
    AnyNode::ERBBeginNode(node) => erb!(node),
    AnyNode::ERBUnlessNode(node) => erb!(node),
    AnyNode::ERBYieldNode(node) => erb!(node),
    _ => None,
  }
}

pub fn is_output_tag_opening(tag_opening: &str) -> bool {
  tag_opening == "<%=" || tag_opening == "<%=="
}

pub fn is_comment_erb(tag_opening: &str, content: &str) -> bool {
  tag_opening == "<%#" || content.trim_start().starts_with('#')
}

pub fn leading_whitespace_length(content: &str) -> usize {
  content.len() - content.trim_start().len()
}

pub fn trailing_whitespace_length(content: &str) -> usize {
  content.len() - content.trim_end().len()
}
