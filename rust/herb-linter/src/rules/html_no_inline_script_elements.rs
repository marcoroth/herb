use crate::utils::tag_utils::{get_element_attribute, get_tag_local_name, is_javascript_tag_element, open_tag_location};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

rule_visitor!(NoInlineScriptElementsVisitor);
define_parser_rule!(
  HTMLNoInlineScriptElementsRule,
  "html-no-inline-script-elements",
  Error,
  NoInlineScriptElementsVisitor,
  enabled: false,
  parser_options: { action_view_helpers: true },
  introduced_in: "unreleased"
);

fn ignored_element_sources() -> [&'static str; 2] {
  [
    "ActionView::Helpers::AssetTagHelper#javascript_include_tag",
    "ActionView::Helpers::JavaScriptHelper#javascript_tag",
  ]
}

fn is_external_script(node: &HTMLElementNode) -> bool {
  get_element_attribute(node, "src").is_some() && node.body.is_empty()
}

fn is_inline_script(node: &HTMLElementNode) -> bool {
  if get_tag_local_name(node).as_deref() != Some("script") {
    return false;
  }

  if !is_javascript_tag_element(node) {
    return false;
  }

  if ignored_element_sources().contains(&node.element_source.as_str()) {
    return false;
  }

  !is_external_script(node)
}

impl Visitor for NoInlineScriptElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if is_inline_script(node) {
      self.add_offense(
        "Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.",
        open_tag_location(node),
      );
    }

    self.walk_html_element_node(node);
  }
}
