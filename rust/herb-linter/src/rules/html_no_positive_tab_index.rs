use crate::utils::tag_utils::{get_attribute, get_static_attribute_value};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoPositiveTabIndexVisitor);
define_parser_rule!(HTMLNoPositiveTabIndexRule, "html-no-positive-tab-index", Error, NoPositiveTabIndexVisitor);

impl Visitor for NoPositiveTabIndexVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tabindex_attribute) = get_attribute(node, "tabindex") {
      if let Some(value) = get_static_attribute_value(tabindex_attribute) {
        if let Ok(tab_index) = value.trim().parse::<i32>() {
          if tab_index > 0 {
            self.add_offense(
              "Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.".to_string(),
              tabindex_attribute.location.clone(),
            );
          }
        }
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
