use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute, get_tag_name_from_open_tag, has_attribute, tag_name_location};

use herb::nodes::{AnyNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(AvoidBothDisabledAndAriaDisabledVisitor);
define_parser_rule!(
  HTMLAvoidBothDisabledAndAriaDisabledRule,
  "html-avoid-both-disabled-and-aria-disabled",
  Error,
  AvoidBothDisabledAndAriaDisabledVisitor
);

static ELEMENTS_WITH_NATIVE_DISABLED: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  ["button", "fieldset", "input", "optgroup", "option", "select", "textarea"]
    .into_iter()
    .collect()
});

fn has_erb_content_in_attribute(node: &HTMLOpenTagNode, attribute_name: &str) -> bool {
  let attribute = match get_attribute(node, attribute_name) {
    Some(attribute) => attribute,
    None => return false,
  };

  let value_node = match &attribute.value {
    Some(value_node) => value_node,
    None => return false,
  };

  value_node.children.iter().any(|child| matches!(child, AnyNode::ERBContentNode(_)))
}

impl Visitor for AvoidBothDisabledAndAriaDisabledVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      let tag_lower = tag_name.to_lowercase();

      if ELEMENTS_WITH_NATIVE_DISABLED.contains(tag_lower.as_str()) {
        let has_disabled = has_attribute(node, "disabled");
        let has_aria_disabled = has_attribute(node, "aria-disabled");

        if (has_disabled && has_erb_content_in_attribute(node, "disabled")) || (has_aria_disabled && has_erb_content_in_attribute(node, "aria-disabled")) {
          // Skip if either attribute contains dynamic ERB content
        } else if has_disabled && has_aria_disabled {
          self.add_offense(
            "aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.".to_string(),
            tag_name_location(node),
          );
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
