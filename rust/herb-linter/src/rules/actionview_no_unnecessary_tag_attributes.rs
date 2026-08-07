use crate::autofix::{erb_output_node, for_each_node_array_mut};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::action_view_utils::is_tag_attributes_call;
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::html_data::is_void_element;
use crate::utils::tag_utils::{get_open_tag, get_tag_local_name};
use herb::nodes::DocumentNode;

use herb::nodes::{AnyNode, HTMLElementNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(ActionViewNoUnnecessaryTagAttributesVisitor);
define_parser_rule!(
  ActionViewNoUnnecessaryTagAttributesRule,
  "actionview-no-unnecessary-tag-attributes",
  Warning,
  ActionViewNoUnnecessaryTagAttributesVisitor,
  parser_options: { prism_nodes: true },
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "0.9.3"
);

fn has_only_tag_attributes_children(open_tag: &HTMLOpenTagNode) -> bool {
  let children: Vec<&AnyNode> = open_tag.children.iter().filter(|child| !matches!(child, AnyNode::WhitespaceNode(_))).collect();

  if children.is_empty() {
    return false;
  }

  if children.iter().any(|child| matches!(child, AnyNode::HTMLAttributeNode(_))) {
    return false;
  }

  children.iter().all(|child| {
    let erb = match child {
      AnyNode::ERBContentNode(erb) => erb,
      _ => return false,
    };

    let tag_opening = erb.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

    if !is_output_tag_opening(tag_opening) {
      return false;
    }

    erb.prism().map(is_tag_attributes_call).unwrap_or(false)
  })
}

impl Visitor for ActionViewNoUnnecessaryTagAttributesVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(open_tag) = get_open_tag(node) {
      if let Some(tag_name) = get_tag_local_name(node) {
        if has_only_tag_attributes_children(open_tag) {
          self.add_offense(
            format!(
              "Avoid using `tag.attributes` to set all attributes on `<{}>`. Use `tag.{}` or add the attributes directly to the `<{}>` tag instead.",
              tag_name, tag_name, tag_name
            ),
            open_tag.location.clone(),
          );
        }
      }
    }

    self.walk_html_element_node(node);
  }
}

/// The arguments of a `tag.attributes(...)` call inside an open tag.
fn tag_attributes_arguments(open_tag: &HTMLOpenTagNode) -> Option<String> {
  let erb = open_tag.children.iter().find_map(|child| match child {
    AnyNode::ERBContentNode(erb) => {
      let tag_opening = erb.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("");

      if is_output_tag_opening(tag_opening) {
        Some(erb)
      } else {
        None
      }
    }
    _ => None,
  })?;

  let content = erb.content.as_ref()?.value.trim();
  let inner = content.strip_prefix("tag.attributes(")?.strip_suffix(')')?;

  if inner.is_empty() {
    None
  } else {
    Some(inner.to_string())
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_node_array_mut(document, &mut |array| {
    if fixed {
      return;
    }

    let index = array.iter().position(|node| match node {
      AnyNode::HTMLElementNode(element) => crate::utils::tag_utils::get_open_tag(element)
        .map(|open_tag| crate::autofix::location_matches(&open_tag.location, offense))
        .unwrap_or(false),
      _ => false,
    });

    let index = match index {
      Some(index) => index,
      None => return,
    };

    let (tag_name, arguments, body, has_body, is_void) = match &array[index] {
      AnyNode::HTMLElementNode(element) => {
        let open_tag = match crate::utils::tag_utils::get_open_tag(element) {
          Some(open_tag) => open_tag,
          None => return,
        };

        let tag_name = match crate::utils::tag_utils::get_tag_local_name(element) {
          Some(tag_name) => tag_name,
          None => return,
        };

        let arguments = match tag_attributes_arguments(open_tag) {
          Some(arguments) => arguments,
          None => return,
        };

        (
          tag_name.clone(),
          arguments,
          element.body.clone(),
          !element.body.is_empty(),
          is_void_element(&tag_name),
        )
      }
      _ => return,
    };

    let mut replacements: Vec<AnyNode> = Vec::new();

    if is_void || !has_body {
      replacements.push(AnyNode::ERBContentNode(Box::new(erb_output_node(
        &format!(" tag.{}({}) ", tag_name, arguments),
        "<%=",
        "%>",
      ))));
    } else {
      replacements.push(AnyNode::ERBContentNode(Box::new(erb_output_node(
        &format!(" tag.{}({}) do ", tag_name, arguments),
        "<%=",
        "%>",
      ))));

      replacements.extend(body);

      replacements.push(AnyNode::ERBContentNode(Box::new(erb_output_node(" end ", "<%", "%>"))));
    }

    array.splice(index..index + 1, replacements);

    fixed = true;
  });

  fixed
}
