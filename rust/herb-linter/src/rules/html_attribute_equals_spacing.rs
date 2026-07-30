use crate::autofix::{for_each_attribute_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use herb::nodes::DocumentNode;
use herb::nodes::HTMLAttributeNode;
use herb::Visitor;

rule_visitor!(AttributeEqualsSpacingVisitor);
define_parser_rule!(
  HTMLAttributeEqualsSpacingRule,
  "html-attribute-equals-spacing",
  Error,
  AttributeEqualsSpacingVisitor,
  autocorrectable: true,
  autofix: autofix
);

impl Visitor for AttributeEqualsSpacingVisitor {
  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    if node.name.is_none() || node.value.is_none() {
      self.walk_html_attribute_node(node);

      return;
    }

    if let Some(ref equals) = node.equals {
      if equals.value.starts_with(' ') {
        self.add_offense("Remove whitespace before `=` in HTML attribute".to_string(), equals.location.clone());
      }

      if equals.value.ends_with(' ') {
        self.add_offense("Remove whitespace after `=` in HTML attribute".to_string(), equals.location.clone());
      }
    }

    self.walk_html_attribute_node(node);
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_attribute_mut(document, &mut |attribute| {
    if let Some(equals) = attribute.equals.as_mut() {
      if location_matches(&equals.location, offense) {
        equals.value = "=".to_string();
        fixed = true;
      }
    }
  });

  fixed
}
