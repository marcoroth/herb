use herb::nodes::ERBIterationBlockNode;
use herb::Visitor;

rule_visitor!(PreferEachOverMapVisitor);
define_parser_rule!(
  ERBPreferEachOverMapRule,
  "erb-prefer-each-over-map",
  Error,
  PreferEachOverMapVisitor,
  parser_options: { iteration_nodes: true },
  introduced_in: "unreleased"
);

const VALUE_RETURNING_METHODS: &[&str] = &["map", "flat_map", "select", "filter", "reject", "filter_map"];

impl Visitor for PreferEachOverMapVisitor {
  fn visit_erb_iteration_block_node(&mut self, node: &ERBIterationBlockNode) {
    let is_output = node
      .tag_opening
      .as_ref()
      .map(|token| token.value == "<%=" || token.value == "<%==")
      .unwrap_or(false);

    if !is_output {
      if let Some(message) = node.message.as_ref() {
        if VALUE_RETURNING_METHODS.contains(&message.value.as_str()) {
          self.add_offense(
            format!(
              "`{}` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.",
              message.value
            ),
            message.location.clone(),
          );
        }
      }
    }

    self.walk_erb_iteration_block_node(node);
  }
}
