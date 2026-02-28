use crate::utils::html_data::is_void_element;
use crate::utils::tag_utils::get_tag_name_from_open_tag;

use herb::nodes::*;
use herb::Visitor;

rule_visitor!(NoSelfClosingVisitor);
define_parser_rule!(
  HTMLNoSelfClosingRule,
  "html-no-self-closing",
  Error,
  NoSelfClosingVisitor,
  exclude: ["**/views/**/*_mailer/**/*"]
);

impl Visitor for NoSelfClosingVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.as_str()) {
      if tag_name.eq_ignore_ascii_case("svg") {
        if let Some(open_tag) = crate::utils::tag_utils::get_open_tag(node) {
          self.visit_html_open_tag_node(open_tag);
        }

        return;
      }
    }

    self.walk_html_element_node(node);
  }

  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(closing) = &node.tag_closing {
      if closing.value == "/>" {
        let tag_name = get_tag_name_from_open_tag(node).unwrap_or("unknown");
        let instead = if is_void_element(tag_name) {
          format!("<{}>", tag_name)
        } else {
          format!("<{}></{}>", tag_name, tag_name)
        };

        self.add_offense(
          format!("Use `{}` instead of self-closing `<{} />` for HTML compatibility.", instead, tag_name),
          node.location.clone(),
        );
      }
    }
  }
}
