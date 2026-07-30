use crate::utils::attribute_visitor::{classify_attribute, AttributeKind};
use crate::utils::erb_utils::{as_erb_node, is_output_tag_opening};
use crate::utils::tag_utils::get_attributes;

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(ERBNoUnsafeJSAttributeVisitor);
define_parser_rule!(ERBNoUnsafeJSAttributeRule, "erb-no-unsafe-js-attribute", Error, ERBNoUnsafeJSAttributeVisitor,
  introduced_in: "0.9.0"
);

/// Mirrors `/\.to_json\s*$|\bj\s*[\s(]|\bescape_javascript\s*[\s(]/`.
fn is_safely_encoded(content: &str) -> bool {
  if content.trim_end().ends_with(".to_json") {
    return true;
  }

  has_call_like(content, "j") || has_call_like(content, "escape_javascript")
}

/// Whether `name` appears on a word boundary directly followed by whitespace or
/// an opening paren, matching `\bname\s*[\s(]`.
fn has_call_like(content: &str, name: &str) -> bool {
  let bytes = content.as_bytes();
  let mut start = 0;

  while let Some(offset) = content[start..].find(name) {
    let index = start + offset;
    let rest = &content[index + name.len()..];

    let boundary_before = index == 0 || !is_word_byte(bytes[index - 1]);
    let followed_by_call = rest.starts_with(char::is_whitespace) || rest.starts_with('(');

    if boundary_before && followed_by_call {
      return true;
    }

    start = index + 1;
  }

  false
}

fn is_word_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_'
}

impl Visitor for ERBNoUnsafeJSAttributeVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    for attribute in get_attributes(node) {
      if let Some(AttributeKind::StaticNameDynamicValue {
        attribute_name, value_nodes, ..
      }) = classify_attribute(attribute)
      {
        if !attribute_name.starts_with("on") {
          continue;
        }

        for value_node in value_nodes {
          if let Some((tag_opening, content, location)) = as_erb_node(value_node) {
            if !is_output_tag_opening(tag_opening) {
              continue;
            }

            if is_safely_encoded(content.trim()) {
              continue;
            }

            self.add_offense(
              format!(
                "Unsafe ERB output in `{}` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.",
                attribute_name
              ),
              location.clone(),
            );
          }
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
