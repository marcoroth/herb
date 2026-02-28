use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(AnchorRequireHrefVisitor);
define_parser_rule!(HTMLAnchorRequireHrefRule, "html-anchor-require-href", Error, AnchorRequireHrefVisitor);

impl Visitor for AnchorRequireHrefVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    let tag_name = get_tag_name_from_open_tag(node);

    if tag_name.map(|n| n.eq_ignore_ascii_case("a")).unwrap_or(false) {
      match get_attribute(node, "href") {
        None => {
          self.add_offense(
            "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should go somewhere, you probably want to use a `<button>` instead.".to_string(),
            tag_name_location(node),
          );
        }

        Some(href_attribute) => {
          if get_static_attribute_value(href_attribute).as_deref() == Some("#") {
            self.add_offense(
              "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should go somewhere, you probably want to use a `<button>` instead.".to_string(),
              tag_name_location(node),
            );
          }
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
