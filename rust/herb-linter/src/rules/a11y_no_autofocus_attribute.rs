use crate::utils::tag_utils::{has_attribute, tag_name_location};

use herb::nodes::{ERBContentNode, HTMLOpenTagNode};
use herb::prism::PrismNode;
use herb::Visitor;

const FORM_BUILDER_METHODS: &[&str] = &["text_area", "text_field", "textarea"];

rule_visitor!(NoAutofocusAttributeVisitor);
define_parser_rule!(
  A11yNoAutofocusAttributeRule,
  "a11y-no-autofocus-attribute",
  Warning,
  NoAutofocusAttributeVisitor,
  enabled: false,
  parser_options: { prism_nodes: true },
  introduced_in: "0.9.3"
);

fn is_form_tag_helper(name: &str) -> bool {
  herb::action_view_helpers::entries().iter().any(|entry| {
    let module = entry.source.split('#').next().unwrap_or("").rsplit("::").next().unwrap_or("");

    if module != "FormTagHelper" {
      return false;
    }

    if !matches!(entry.tag_name, Some("input") | Some("textarea") | Some("select")) {
      return false;
    }

    entry.name == name || entry.aliases.contains(&name)
  })
}

#[derive(Default)]
struct AutofocusKeywordDetector {
  has_autofocus: bool,
  is_inside_form_helper: bool,
}

impl AutofocusKeywordDetector {
  fn visit(&mut self, node: &PrismNode) {
    if node.is("CallNode") {
      let name = node.name.as_deref().unwrap_or("");

      let is_builder_method = node.receiver().is_some() && FORM_BUILDER_METHODS.contains(&name);
      let is_tag_helper = node.receiver().is_none() && is_form_tag_helper(name);

      if is_builder_method || is_tag_helper {
        self.is_inside_form_helper = true;
        self.visit_children(node);
        self.is_inside_form_helper = false;
      } else {
        self.visit_children(node);
      }

      return;
    }

    if node.is("AssocNode") {
      if !self.is_inside_form_helper {
        return;
      }

      let key = match node.key {
        Some(ref key) if key.is("SymbolNode") => key,
        _ => return,
      };

      self.has_autofocus = key.unescaped.as_deref() == Some("autofocus");

      return;
    }

    self.visit_children(node);
  }

  fn visit_children(&mut self, node: &PrismNode) {
    for child in &node.children {
      self.visit(child);
    }
  }
}

impl Visitor for NoAutofocusAttributeVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if has_attribute(node, "autofocus") {
      self.add_offense(
        "Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.",
        tag_name_location(node),
      );
    }

    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    if let Some(prism_node) = node.prism() {
      let mut detector = AutofocusKeywordDetector::default();

      detector.visit(prism_node);

      if detector.has_autofocus {
        self.add_offense(
          "Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.",
          node.location.clone(),
        );
      }
    }

    self.walk_erb_content_node(node);
  }
}
