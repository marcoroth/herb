use herb::nodes::{AnyNode, HTMLAttributeNameNode};
use herb::Visitor;

const SILENT_TAGS: &[&str] = &["<%", "<%-", "<%#"];

rule_visitor!(NoSilentTagInAttributeNameVisitor);
define_parser_rule!(
  ERBNoSilentTagInAttributeNameRule,
  "erb-no-silent-tag-in-attribute-name",
  Error,
  NoSilentTagInAttributeNameVisitor
);

impl Visitor for NoSilentTagInAttributeNameVisitor {
  fn visit_html_attribute_name_node(&mut self, node: &HTMLAttributeNameNode) {
    for child in &node.children {
      if let AnyNode::ERBContentNode(erb) = child {
        if let Some(ref tag_opening) = erb.tag_opening {
          if SILENT_TAGS.contains(&tag_opening.value.as_str()) {
            self.add_offense(
              format!(
                "Remove silent ERB tag from HTML attribute name. Silent ERB tags (`{}`) do not output content and should not be used in attribute names.",
                tag_opening.value
              ),
              erb.location.clone(),
            );
          }
        }
      }
    }

    self.walk_html_attribute_name_node(node);
  }
}
