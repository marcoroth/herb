use crate::utils::tag_utils::{get_tag_name_from_open_tag, has_aria_hidden, tag_name_location};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

rule_visitor!(NoAriaHiddenOnBodyVisitor);
define_parser_rule!(HTMLNoAriaHiddenOnBodyRule, "html-no-aria-hidden-on-body", Error, NoAriaHiddenOnBodyVisitor);

impl Visitor for NoAriaHiddenOnBodyVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if tag_name.eq_ignore_ascii_case("body") && has_aria_hidden(node) {
        self.add_offense(
          "The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users."
            .to_string(),
          tag_name_location(node),
        );
      }
    }

    self.walk_html_open_tag_node(node);
  }
}
