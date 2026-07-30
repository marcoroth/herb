use herb::nodes::{AnyNode, ERBCaseMatchNode, ERBCaseNode};
use herb::Location;
use herb::Visitor;

rule_visitor!(ERBNoInlineCaseConditionsVisitor);
define_parser_rule!(
  ERBNoInlineCaseConditionsRule,
  "erb-no-inline-case-conditions",
  Warning,
  ERBNoInlineCaseConditionsVisitor,
  parser_options: { strict: false }
);

impl ERBNoInlineCaseConditionsVisitor {
  fn check_conditions(&mut self, conditions: &[AnyNode], location: &Location, condition_type: &str) {
    let has_inline_condition = conditions.iter().any(|condition| match condition {
      AnyNode::ERBWhenNode(when) => when.tag_opening.is_none(),
      AnyNode::ERBInNode(in_node) => in_node.tag_opening.is_none(),
      _ => false,
    });

    if has_inline_condition {
      self.add_offense(
        format!(
          "A `case` statement with `{}` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for `case` and its conditions (e.g., `<% case x %>` followed by `<% {} y %>`).",
          condition_type, condition_type
        ),
        location.clone(),
      );
    }
  }
}

impl Visitor for ERBNoInlineCaseConditionsVisitor {
  fn visit_erb_case_node(&mut self, node: &ERBCaseNode) {
    self.check_conditions(&node.conditions, &node.location, "when");
    self.walk_erb_case_node(node);
  }

  fn visit_erb_case_match_node(&mut self, node: &ERBCaseMatchNode) {
    self.check_conditions(&node.conditions, &node.location, "in");
    self.walk_erb_case_match_node(node);
  }
}
