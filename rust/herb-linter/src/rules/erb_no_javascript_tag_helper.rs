use crate::utils::tag_utils::get_tag_local_name;

use herb::nodes::HTMLElementNode;
use herb::union_types::ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(ERBNoJavascriptTagHelperVisitor);
define_parser_rule!(
  ERBNoJavascriptTagHelperRule,
  "erb-no-javascript-tag-helper",
  Warning,
  ERBNoJavascriptTagHelperVisitor,
  parser_options: { action_view_helpers: true }
);

fn javascript_tag_element_source() -> &'static str {
  herb::action_view_helpers::find_by_name("javascript_tag")
    .map(|entry| entry.source)
    .unwrap_or("")
}

impl Visitor for ERBNoJavascriptTagHelperVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("script") {
      if let Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(open_tag)) = &node.open_tag {
        if node.element_source == javascript_tag_element_source() {
          self.add_offense("Avoid `javascript_tag`. Use inline `<script>` tags instead.", open_tag.location.clone());
        }
      }
    }

    self.walk_html_element_node(node);
  }
}
