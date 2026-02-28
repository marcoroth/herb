use crate::utils::tag_utils::{get_attribute_name, get_attributes, get_static_attribute_value};

use herb::nodes::{AnyNode, HTMLOpenTagNode};
use herb::Visitor;

rule_visitor!(AttributeDoubleQuotesVisitor);
define_parser_rule!(
  HTMLAttributeDoubleQuotesRule,
  "html-attribute-double-quotes",
  Warning,
  AttributeDoubleQuotesVisitor
);

impl Visitor for AttributeDoubleQuotesVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      let value_node = match &attribute.value {
        Some(value_node) => value_node,
        None => continue,
      };

      let open_quote = match &value_node.open_quote {
        Some(quote) => quote,
        None => continue,
      };

      if open_quote.value != "'" {
        continue;
      }

      let attribute_name = match get_attribute_name(attribute) {
        Some(name) => name.to_string(),
        None => continue,
      };

      let has_double_quote = value_node.children.iter().any(|child| {
        if let AnyNode::LiteralNode(literal) = child {
          literal.content.contains('"')
        } else {
          false
        }
      });

      if has_double_quote {
        continue;
      }

      let attribute_value = get_static_attribute_value(attribute).unwrap_or_default();

      // TODO: use IdentityPrinter from herb-printer to print the attribute value node
      let combined_value = if attribute_value.is_empty() {
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
      } else {
        attribute_value
      };

      self.add_offense(
        format!(
          "Attribute `{}` uses single quotes. Prefer double quotes for HTML attribute values: `{}=\"{}\"`.",
          attribute_name, attribute_name, combined_value
        ),
        value_node.location.clone(),
      );
    }

    self.walk_html_open_tag_node(node);
  }
}
