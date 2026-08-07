use crate::utils::prism_utils::call_arguments;

use herb::nodes::{AnyNode, ERBRenderNode, RubyRenderLocalNode};
use herb::Visitor;

rule_visitor!(NoRenderOptionShadowingVisitor);
define_parser_rule!(
  ActionViewNoRenderOptionShadowingRule,
  "actionview-no-render-option-shadowing",
  Info,
  NoRenderOptionShadowingVisitor,
  parser_options: { render_nodes: true, prism_nodes: true },
  introduced_in: "unreleased"
);

const RENDER_OPTIONS: &[&str] = &[
  "as",
  "cached",
  "collection",
  "content_type",
  "formats",
  "handlers",
  "layout",
  "object",
  "spacer_template",
  "template",
  "variants",
];

fn is_shorthand_form(node: &ERBRenderNode) -> bool {
  let call = match node.prism() {
    Some(call) if call.is("CallNode") => call,
    _ => return false,
  };

  match call_arguments(call).first() {
    Some(first) => !first.is("KeywordHashNode"),
    None => false,
  }
}

impl NoRenderOptionShadowingVisitor {
  fn check_local(&mut self, local: &RubyRenderLocalNode) {
    let name = match local.name.as_ref() {
      Some(name) => name,
      None => return,
    };

    if !RENDER_OPTIONS.contains(&name.value.as_str()) {
      return;
    }

    self.add_offense(
      format!(
        "The local `{}` shadows the `render` option of the same name. Every keyword in the shorthand `render \"partial\", ...` form becomes a local, but the same keyword after `render partial: \"...\"` is a render option instead. Move it into an explicit `locals: {{ {}: ... }}` hash so there is only one way to read it.",
        name.value, name.value
      ),
      name.location.clone(),
    );
  }
}

impl Visitor for NoRenderOptionShadowingVisitor {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    if is_shorthand_form(node) {
      let locals: Vec<&RubyRenderLocalNode> = node
        .keywords
        .as_ref()
        .map(|keywords| {
          keywords
            .locals
            .iter()
            .filter_map(|local| match local {
              AnyNode::RubyRenderLocalNode(local) => Some(local.as_ref()),
              _ => None,
            })
            .collect()
        })
        .unwrap_or_default();

      for local in locals {
        self.check_local(local);
      }
    }

    self.walk_erb_render_node(node);
  }
}
