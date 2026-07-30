use crate::autofix::{close_tag_for, for_each_element_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use crate::utils::html_data::is_void_element;
use crate::utils::tag_utils::get_tag_name_from_element;
use crate::utils::tag_utils::get_tag_name_from_open_tag;
use herb::nodes::DocumentNode;
use herb::union_types::*;

use herb::nodes::*;
use herb::Visitor;

rule_visitor!(NoSelfClosingVisitor);
define_parser_rule!(
  HTMLNoSelfClosingRule,
  "html-no-self-closing",
  Error,
  NoSelfClosingVisitor,
  exclude: ["**/views/**/*_mailer/**/*"],
  parser_options: { action_view_helpers: true },
  autocorrectable: true,
  autofix: autofix
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
          closing.location.clone(),
        );
      }
    }
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_element_mut(document, &mut |element| {
    let tag_name = get_tag_name_from_element(element).map(String::from);
    let is_void = tag_name.as_deref().map(is_void_element).unwrap_or(false);

    let open_tag = match element.open_tag.as_mut() {
      Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open_tag)) => open_tag,
      _ => return,
    };

    let matches = open_tag
      .tag_closing
      .as_ref()
      .map(|token| location_matches(&token.location, offense))
      .unwrap_or(false);

    if !matches {
      return;
    }

    if let Some(closing) = open_tag.tag_closing.as_mut() {
      closing.value = ">".to_string();
    }

    // drop a trailing space that only existed to separate `/>`
    if let Some(AnyNode::WhitespaceNode(_)) = open_tag.children.last() {
      let is_indentation = matches!(
        open_tag.children.iter().nth_back(1),
        Some(AnyNode::WhitespaceNode(previous)) if previous.value.as_ref().map(|token| token.value.contains('\n')).unwrap_or(false)
      );

      if !is_indentation {
        open_tag.children.pop();
      }
    }

    if !is_void {
      if let Some(tag_name) = tag_name {
        element.close_tag =
          Some(ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(Box::new(close_tag_for(&tag_name))));
      }
    }

    fixed = true;
  });

  fixed
}
