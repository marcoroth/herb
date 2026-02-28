use crate::utils::tag_utils::{get_tag_name_from_open_tag, has_attribute, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(ImgRequireAltVisitor);
define_parser_rule!(HTMLImgRequireAltRule, "html-img-require-alt", Error, ImgRequireAltVisitor);

impl Visitor for ImgRequireAltVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if tag_name.eq_ignore_ascii_case("img") && !has_attribute(node, "alt") {
        self.add_offense(
          "Missing required `alt` attribute on `<img>` tag. Add `alt=\"\"` for decorative images or `alt=\"description\"` for informative images.".to_string(),
          tag_name_location(node),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
