use crate::utils::erb_utils::is_output_tag_opening;
use crate::utils::prism_utils::walk_prism;
use crate::utils::tag_utils::{get_attribute, get_open_tag, get_static_attribute_value};

use herb::nodes::{AnyNode, HTMLElementNode};
use herb::prism::PrismNode;
use herb::Visitor;

const SAFE_METHOD_NAMES: &[&str] = &["to_json", "json_escape"];
const ESCAPE_JAVASCRIPT_METHOD_NAMES: &[&str] = &["j", "escape_javascript"];

rule_visitor!(ERBNoUnsafeScriptInterpolationVisitor);
define_parser_rule!(
  ERBNoUnsafeScriptInterpolationRule,
  "erb-no-unsafe-script-interpolation",
  Error,
  ERBNoUnsafeScriptInterpolationVisitor,
  parser_options: { prism_nodes: true },
  introduced_in: "0.9.0"
);

#[derive(Default)]
struct SafeCallDetector {
  has_safe_call: bool,
  has_escape_javascript_call: bool,
}

impl SafeCallDetector {
  fn detect(prism_node: &PrismNode) -> Self {
    let mut detector = Self::default();

    walk_prism(prism_node, &mut |node| {
      if node.is("CallNode") {
        if let Some(name) = node.name.as_deref() {
          if SAFE_METHOD_NAMES.contains(&name) {
            detector.has_safe_call = true;
          }

          if ESCAPE_JAVASCRIPT_METHOD_NAMES.contains(&name) {
            detector.has_escape_javascript_call = true;
          }
        }
      }

      true
    });

    detector
  }
}

impl ERBNoUnsafeScriptInterpolationVisitor {
  fn check_nodes_for_unsafe_output(&mut self, nodes: &[AnyNode]) {
    for child in nodes {
      let (tag_opening_token, location, prism_node) = match child {
        AnyNode::ERBContentNode(erb) => (erb.tag_opening.as_ref(), &erb.location, erb.prism()),
        AnyNode::ERBBlockNode(erb) => (erb.tag_opening.as_ref(), &erb.location, erb.prism()),
        AnyNode::ERBRenderNode(erb) => (erb.tag_opening.as_ref(), &erb.location, erb.prism()),
        AnyNode::ERBYieldNode(erb) => (erb.tag_opening.as_ref(), &erb.location, None),
        _ => continue,
      };

      let tag_opening = tag_opening_token.map(|token| token.value.as_str()).unwrap_or("");

      if !is_output_tag_opening(tag_opening) {
        continue;
      }

      let detector = match prism_node {
        Some(prism_node) => SafeCallDetector::detect(prism_node),
        None => SafeCallDetector::default(),
      };

      if detector.has_safe_call {
        continue;
      }

      if detector.has_escape_javascript_call {
        self.add_offense(
          "Avoid `j()` / `escape_javascript()` in `<script>` tags. It is only safe inside quoted string literals. Use `.to_json` instead, which is safe in any position.",
          location.clone(),
        );

        continue;
      }

      self.add_offense(
        "Unsafe ERB output in `<script>` tag. Use `.to_json` to safely serialize values into JavaScript.",
        location.clone(),
      );
    }
  }
}

impl Visitor for ERBNoUnsafeScriptInterpolationVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(open_tag) = get_open_tag(node) {
      let is_script = open_tag.tag_name.as_ref().map(|token| token.value.to_lowercase()).as_deref() == Some("script");

      let is_html_template = get_attribute(open_tag, "type")
        .and_then(get_static_attribute_value)
        .map(|value| value == "text/html")
        .unwrap_or(false);

      if is_script && !is_html_template {
        self.check_nodes_for_unsafe_output(&node.body);
      }
    }

    self.walk_html_element_node(node);
  }
}
