use crate::utils::tag_utils::{get_tag_name_from_open_tag, has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoTitleAttributeVisitor);
define_parser_rule!(HTMLNoTitleAttributeRule, "html-no-title-attribute", Error, NoTitleAttributeVisitor, enabled: false);

impl Visitor for NoTitleAttributeVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if !tag_name.eq_ignore_ascii_case("iframe") && !tag_name.eq_ignore_ascii_case("link") && has_attribute(node, "title") {
        self.add_offense(
          "The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.".to_string(),
          tag_name_location(node),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
