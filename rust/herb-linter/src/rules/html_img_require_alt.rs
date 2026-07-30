use crate::utils::tag_utils::{element_tag_name_location, get_element_attribute, get_tag_local_name, has_attribute_value};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

rule_visitor!(ImgRequireAltVisitor);
define_parser_rule!(
  HTMLImgRequireAltRule,
  "html-img-require-alt",
  Warning,
  ImgRequireAltVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.4.0"
);

impl Visitor for ImgRequireAltVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("img") {
      match get_element_attribute(node, "alt") {
        None => self.add_offense(
          "Missing required `alt` attribute on `<img>` tag. Add `alt=\"\"` for decorative images or `alt=\"description\"` for informative images.",
          element_tag_name_location(node),
        ),

        Some(attribute) if !has_attribute_value(attribute) => self.add_offense(
          "The `alt` attribute has no value. Add `alt=\"\"` for decorative images or `alt=\"description\"` for informative images.",
          attribute.location.clone(),
        ),

        Some(_) => {}
      }
    }

    self.walk_html_element_node(node);
  }
}
