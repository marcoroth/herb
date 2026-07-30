use crate::utils::erb_utils::{as_erb_node, is_comment_erb, is_output_tag_opening};
use crate::utils::tag_utils::{get_attribute, get_open_tag, get_static_attribute_value};

use herb::nodes::{AnyNode, HTMLElementNode};
use herb::Visitor;

rule_visitor!(ERBNoStatementInScriptVisitor);
define_parser_rule!(ERBNoStatementInScriptRule, "erb-no-statement-in-script", Warning, ERBNoStatementInScriptVisitor);

/// Matches an ERB tag that only closes a block, e.g. `<% end %>`.
fn is_end_statement(content: &str) -> bool {
  let trimmed = content.trim_start();

  trimmed
    .strip_prefix("end")
    .map(|rest| !rest.starts_with(|c: char| c.is_alphanumeric() || c == '_'))
    .unwrap_or(false)
}

impl ERBNoStatementInScriptVisitor {
  fn check_nodes_for_statements(&mut self, nodes: &[AnyNode]) {
    for child in nodes {
      let (tag_opening, content, location) = match as_erb_node(child) {
        Some(parts) => parts,
        None => continue,
      };

      if is_output_tag_opening(tag_opening) || is_comment_erb(tag_opening, content) {
        continue;
      }

      if is_end_statement(content) {
        continue;
      }

      self.add_offense(
        "Avoid `<% %>` tags inside `<script>`. Use `<%= %>` to interpolate values into JavaScript.",
        location.clone(),
      );
    }
  }
}

impl Visitor for ERBNoStatementInScriptVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(open_tag) = get_open_tag(node) {
      let is_script = open_tag.tag_name.as_ref().map(|token| token.value.to_lowercase()).as_deref() == Some("script");

      let is_html_template = get_attribute(open_tag, "type")
        .and_then(get_static_attribute_value)
        .map(|value| value == "text/html")
        .unwrap_or(false);

      if is_script && !is_html_template {
        self.check_nodes_for_statements(&node.body);
      }
    }

    self.walk_html_element_node(node);
  }
}
