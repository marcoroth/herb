use crate::autofix::{for_each_attribute_mut, location_matches, quote_token};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::tag_utils::{get_attribute_name, get_attributes, get_static_attribute_value};
use herb::nodes::DocumentNode;

use herb::nodes::{AnyNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(AttributeValuesRequireQuotesVisitor);
define_parser_rule!(
  HTMLAttributeValuesRequireQuotesRule,
  "html-attribute-values-require-quotes",
  Error,
  AttributeValuesRequireQuotesVisitor,
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "0.4.0"
);

impl Visitor for AttributeValuesRequireQuotesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      let value_node = match &attribute.value {
        Some(value_node) => value_node,
        None => continue,
      };

      if value_node.quoted {
        continue;
      }

      let attribute_name = match get_attribute_name(attribute) {
        Some(name) => name.to_string(),
        None => continue,
      };

      // TODO: use IdentityPrinter from herb-printer to print the attribute value node
      let attribute_value = match get_static_attribute_value(attribute) {
        Some(value) => value,
        None => {
          let mut combined = String::new();

          for child in &value_node.children {
            match child {
              AnyNode::LiteralNode(literal) => combined.push_str(&literal.content),
              AnyNode::ERBContentNode(erb) => {
                if let Some(ref opening) = erb.tag_opening {
                  combined.push_str(&opening.value);
                }

                if let Some(ref content) = erb.content {
                  combined.push_str(&content.value);
                }

                if let Some(ref closing) = erb.tag_closing {
                  combined.push_str(&closing.value);
                }
              }
              _ => {}
            }
          }

          combined
        }
      };

      self.add_offense(
        format!(
          "Attribute value should be quoted: `{}=\"{}\"`. Always wrap attribute values in quotes.",
          attribute_name, attribute_value
        ),
        value_node.location.clone(),
      );
    }

    self.walk_html_open_tag_node(node);
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_attribute_mut(document, &mut |attribute| {
    let value = match attribute.value.as_mut() {
      Some(value) if location_matches(&value.location, offense) => value,
      _ => return,
    };

    match value.open_quote.as_mut() {
      Some(open_quote) => open_quote.value = "\"".to_string(),
      None => value.open_quote = Some(quote_token()),
    }

    match value.close_quote.as_mut() {
      Some(close_quote) => close_quote.value = "\"".to_string(),
      None => value.close_quote = Some(quote_token()),
    }

    value.quoted = true;
    fixed = true;
  });

  fixed
}
