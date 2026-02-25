use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute_name, get_attributes};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

static ARIA_ATTRIBUTES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "aria-activedescendant",
    "aria-atomic",
    "aria-autocomplete",
    "aria-busy",
    "aria-checked",
    "aria-colcount",
    "aria-colindex",
    "aria-colspan",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-details",
    "aria-disabled",
    "aria-dropeffect",
    "aria-errormessage",
    "aria-expanded",
    "aria-flowto",
    "aria-grabbed",
    "aria-haspopup",
    "aria-hidden",
    "aria-invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-level",
    "aria-live",
    "aria-modal",
    "aria-multiline",
    "aria-multiselectable",
    "aria-orientation",
    "aria-owns",
    "aria-placeholder",
    "aria-posinset",
    "aria-pressed",
    "aria-readonly",
    "aria-relevant",
    "aria-required",
    "aria-roledescription",
    "aria-rowcount",
    "aria-rowindex",
    "aria-rowspan",
    "aria-selected",
    "aria-setsize",
    "aria-sort",
    "aria-valuemax",
    "aria-valuemin",
    "aria-valuenow",
    "aria-valuetext",
  ]
  .into_iter()
  .collect()
});

rule_visitor!(AriaAttributeMustBeValidVisitor);
define_parser_rule!(
  HTMLAriaAttributeMustBeValidRule,
  "html-aria-attribute-must-be-valid",
  Error,
  AriaAttributeMustBeValidVisitor
);

impl Visitor for AriaAttributeMustBeValidVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      if let Some(name) = get_attribute_name(attribute) {
        let lowercase_name = name.to_lowercase();

        if !lowercase_name.starts_with("aria-") {
          continue;
        }

        if ARIA_ATTRIBUTES.contains(lowercase_name.as_str()) {
          continue;
        }

        self.add_offense(
          format!(
            "The attribute `{}` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.",
            lowercase_name
          ),
          attribute.location.clone(),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
