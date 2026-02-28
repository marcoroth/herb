use std::collections::HashSet;
use std::sync::LazyLock;

use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(InputRequireAutocompleteVisitor);
define_parser_rule!(
  HTMLInputRequireAutocompleteRule,
  "html-input-require-autocomplete",
  Error,
  InputRequireAutocompleteVisitor
);

static INPUT_TYPES_REQUIRING_AUTOCOMPLETE: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "color",
    "date",
    "datetime-local",
    "email",
    "month",
    "number",
    "password",
    "range",
    "search",
    "tel",
    "text",
    "time",
    "url",
    "week",
  ]
  .into_iter()
  .collect()
});

impl Visitor for InputRequireAutocompleteVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if get_tag_name_from_open_tag(node).map(|n| n.eq_ignore_ascii_case("input")).unwrap_or(false) {
      let has_autocomplete = get_attribute(node, "autocomplete")
        .and_then(|attribute| get_static_attribute_value(attribute))
        .is_some();

      if !has_autocomplete {
        if let Some(type_value) = get_attribute(node, "type").and_then(|attribute| get_static_attribute_value(attribute)) {
          if INPUT_TYPES_REQUIRING_AUTOCOMPLETE.contains(type_value.as_str()) {
            self.add_offense(
              "Add an `autocomplete` attribute to improve form accessibility. Use a specific value (e.g., `autocomplete=\"email\"`), `autocomplete=\"on\"` for defaults, or `autocomplete=\"off\"` to disable.".to_string(),
              node.location.clone(),
            );
          }
        }
      }
    }
  }
}
