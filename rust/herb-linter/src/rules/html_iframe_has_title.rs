use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(IframeHasTitleVisitor);
define_parser_rule!(HTMLIframeHasTitleRule, "html-iframe-has-title", Error, IframeHasTitleVisitor);

impl Visitor for IframeHasTitleVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if get_tag_name_from_open_tag(node).map(|n| n.eq_ignore_ascii_case("iframe")).unwrap_or(false) {
      if let Some(aria_hidden_attribute) = get_attribute(node, "aria-hidden") {
        if get_static_attribute_value(aria_hidden_attribute).as_deref() == Some("true") {
          self.walk_html_open_tag_node(node);

          return;
        }
      }

      let title_attribute = get_attribute(node, "title");
      let has_valid_title = match title_attribute {
        None => false,
        Some(attribute) => match get_static_attribute_value(attribute) {
          Some(value) => !value.trim().is_empty(),
          None => attribute.value.is_some(),
        },
      };

      if !has_valid_title {
        self.add_offense(
          "`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.".to_string(),
          node.location.clone(),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
