use crate::utils::action_view_utils::is_action_view_helper_call;
use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::prism_utils::walk_prism;

use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(ActionViewNoSilentHelperVisitor);
define_parser_rule!(
  ActionViewNoSilentHelperRule,
  "actionview-no-silent-helper",
  Error,
  ActionViewNoSilentHelperVisitor,
  parser_options: { action_view_helpers: true, prism_nodes: true },
  introduced_in: "0.9.0"
);

impl Visitor for ActionViewNoSilentHelperVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let tag_opening = match node.tag_opening.as_ref().map(|token| token.value.as_str()) {
      Some(tag_opening) if !tag_opening.is_empty() => tag_opening,
      _ => {
        self.walk_erb_content_node(node);
        return;
      }
    };

    if is_output_tag_opening(tag_opening) || tag_opening.starts_with("<%%") {
      self.walk_erb_content_node(node);
      return;
    }

    if let Some(prism_node) = node.prism() {
      let mut helper_names = Vec::new();

      walk_prism(prism_node, &mut |current| {
        if current.is("CallNode") {
          if let Some(helper_name) = is_action_view_helper_call(current) {
            helper_names.push(helper_name);
          }
        }

        true
      });

      for helper_name in helper_names {
        self.add_offense(
          format!(
            "Avoid using `{} %>` with `{}`. Use `<%= %>` to ensure the helper's output is rendered.",
            tag_opening, helper_name
          ),
          node.location.clone(),
        );
      }
    }

    self.walk_erb_content_node(node);
  }
}
