use crate::autofix::{for_each_attribute_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::tag_utils::{
  get_attribute_name, get_attributes, get_static_attribute_value, has_attribute_value, has_dynamic_attribute_value, print_attribute,
};

use herb::nodes::{AnyNode, DocumentNode, ERBOpenTagNode, HTMLAttributeNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(TurboPermanentNoMisleadingValueVisitor);
define_parser_rule!(
  TurboPermanentNoMisleadingValueRule,
  "turbo-permanent-no-misleading-value",
  Error,
  TurboPermanentNoMisleadingValueVisitor,
  parser_options: { action_view_helpers: true },
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "unreleased"
);

impl TurboPermanentNoMisleadingValueVisitor {
  fn check_attribute(&mut self, attribute: &HTMLAttributeNode) {
    if get_attribute_name(attribute).as_deref() != Some("data-turbo-permanent") {
      return;
    }

    if !has_attribute_value(attribute) {
      return;
    }

    let value_node = match attribute.value.as_ref() {
      Some(value) => value,
      None => return,
    };

    // ActionView renders nil and dynamic values as `RubyLiteralNode`, which
    // cannot be resolved statically, so those are not misleading values
    if value_node.children.iter().any(|child| matches!(child, AnyNode::RubyLiteralNode(_))) {
      return;
    }

    let static_value = get_static_attribute_value(attribute);

    let value_location = value_node.location.clone();

    let is_truthy = static_value.map(|value| value.trim().to_lowercase() == "true").unwrap_or(false);

    let explanation = if is_truthy {
      "is redundant, because Turbo only checks whether the attribute is present."
    } else {
      "still makes the element permanent, because Turbo only checks whether the attribute is present."
    };

    self.add_offense(
      format!(
        "Attribute `data-turbo-permanent` should not have a value. `{}` {} Use `data-turbo-permanent` instead.",
        print_attribute(attribute),
        explanation
      ),
      value_location,
    );
  }
}

impl Visitor for TurboPermanentNoMisleadingValueVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      self.check_attribute(attribute);
    }

    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    for child in &node.children {
      if let AnyNode::HTMLAttributeNode(attribute) = child {
        if !has_dynamic_attribute_value(attribute) {
          self.check_attribute(attribute);
        }
      }
    }

    self.walk_erb_open_tag_node(node);
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_attribute_mut(document, &mut |attribute| {
    let matches = attribute
      .value
      .as_ref()
      .map(|value| location_matches(&value.location, offense))
      .unwrap_or(false);

    if !matches {
      return;
    }

    attribute.equals = None;
    attribute.value = None;
    fixed = true;
  });

  fixed
}
