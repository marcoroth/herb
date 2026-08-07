use crate::utils::tag_utils::{
  element_tag_name_location, get_element_attribute, get_static_attribute_value, get_tag_local_name, has_attribute_value, is_javascript_tag_element,
};

use herb::nodes::{HTMLAttributeNode, HTMLElementNode};
use herb::Visitor;
use herb_config::Severity;

rule_visitor!(RequireScriptNonceVisitor);
define_parser_rule!(
  HTMLRequireScriptNonceRule,
  "html-require-script-nonce",
  Error,
  RequireScriptNonceVisitor,
  parser_options: { action_view_helpers: true },
  introduced_in: "0.9.3"
);

fn helpers_with_csp_nonce_support() -> [&'static str; 2] {
  [
    herb::action_view_helpers::find_by_name("javascript_include_tag")
      .map(|entry| entry.source)
      .unwrap_or(""),
    herb::action_view_helpers::find_by_name("javascript_tag")
      .map(|entry| entry.source)
      .unwrap_or(""),
  ]
}

impl RequireScriptNonceVisitor {
  fn helper_name(node: &HTMLElementNode) -> String {
    if node.element_source.is_empty() {
      return "unknown".to_string();
    }

    match herb::action_view_helpers::find_by_source(&node.element_source) {
      None => node.element_source.clone(),

      Some(helper) if helper.name == "tag" => {
        let tag_name = node.tag_name.as_ref().map(|token| token.value.as_str()).unwrap_or("script");
        format!("tag.{}", tag_name)
      }

      Some(helper) => helper.name.to_string(),
    }
  }

  fn check_literal_nonce_on_tag_helper(&mut self, node: &HTMLElementNode, nonce_attribute: &HTMLAttributeNode) {
    if node.element_source.is_empty() || helpers_with_csp_nonce_support().contains(&node.element_source.as_str()) {
      return;
    }

    let nonce_value = match get_static_attribute_value(nonce_attribute) {
      Some(value) if value == "true" || value == "false" => value,
      _ => return,
    };

    let location = match nonce_attribute.name.as_ref() {
      Some(name_node) => name_node.location.clone(),
      None => return,
    };

    self.add_offense_with_severity(
      format!(
        "`nonce: {}` on `{}` outputs a literal `nonce=\"{}\"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.",
        nonce_value,
        Self::helper_name(node),
        nonce_value
      ),
      location,
      Severity::Error,
    );
  }

  fn check_script_nonce(&mut self, node: &HTMLElementNode) {
    if !is_javascript_tag_element(node) {
      return;
    }

    match get_element_attribute(node, "nonce") {
      Some(nonce_attribute) if has_attribute_value(nonce_attribute) => self.check_literal_nonce_on_tag_helper(node, nonce_attribute),

      _ => self.add_offense(
        "Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.",
        element_tag_name_location(node),
      ),
    }
  }
}

impl Visitor for RequireScriptNonceVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("script") {
      self.check_script_nonce(node);
    }

    self.walk_html_element_node(node);
  }
}
