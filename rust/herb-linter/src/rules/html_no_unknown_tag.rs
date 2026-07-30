use crate::utils::html_data::{is_custom_element, is_known_html_element, is_known_mathml_element, is_known_svg_element};
use crate::utils::tag_utils::{get_open_tag, get_open_tag_name_token, get_tag_local_name};

use herb::nodes::HTMLElementNode;
use herb::Visitor;

const FOREIGN_CONTENT_TAGS: &[&str] = &["svg", "math"];

rule_visitor!(NoUnknownTagVisitor);
define_parser_rule!(
  HTMLNoUnknownTagRule,
  "html-no-unknown-tag",
  Warning,
  NoUnknownTagVisitor,
  exclude: ["**/*.xml.erb"],
  parser_options: { action_view_helpers: true, dot_notation_tags: true },
  introduced_in: "0.9.3"
);

fn is_component_element(node: &HTMLElementNode) -> bool {
  get_open_tag(node)
    .and_then(|open_tag| open_tag.tag_name.as_ref())
    .map(|token| token.value.starts_with(|character: char| character.is_ascii_uppercase()))
    .unwrap_or(false)
}

impl Visitor for NoUnknownTagVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let tag_name = match get_tag_local_name(node) {
      Some(tag_name) => tag_name,
      None => {
        self.walk_html_element_node(node);
        return;
      }
    };

    if FOREIGN_CONTENT_TAGS.contains(&tag_name.as_str()) {
      return;
    }

    if is_component_element(node) {
      self.walk_html_element_node(node);
      return;
    }

    let is_unknown =
      !is_custom_element(&tag_name) && !is_known_html_element(&tag_name) && !is_known_svg_element(&tag_name) && !is_known_mathml_element(&tag_name);

    if is_unknown {
      if let Some(tag_name_token) = get_open_tag_name_token(node) {
        let mut message = format!("Unknown HTML tag `<{}>`. This is not a standard HTML element.", tag_name);

        if tag_name.contains('_') {
          message.push_str(&format!(
            " Did you mean `<{}>`? Custom elements must contain a hyphen.",
            tag_name.replace('_', "-")
          ));
        }

        self.add_offense(message, tag_name_token.location.clone());
      }
    }

    self.walk_html_element_node(node);
  }
}
