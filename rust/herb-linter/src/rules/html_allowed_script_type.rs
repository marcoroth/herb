use crate::utils::tag_utils::{get_attribute, get_static_attribute_value, get_tag_name_from_open_tag};

use herb::nodes::HTMLOpenTagNode;
use herb::Visitor;

const ALLOWED_TYPES: &[&str] = &["text/javascript"];
const ALLOW_BLANK: bool = true;

rule_visitor!(AllowedScriptTypeVisitor);
define_parser_rule!(HTMLAllowedScriptTypeRule, "html-allowed-script-type", Error, AllowedScriptTypeVisitor);

impl Visitor for AllowedScriptTypeVisitor {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if tag_name.eq_ignore_ascii_case("script") {
        self.check_script_node(node);
      }
    }

    self.walk_html_open_tag_node(node);
  }
}

impl AllowedScriptTypeVisitor {
  fn check_script_node(&mut self, node: &HTMLOpenTagNode) {
    let type_attribute = match get_attribute(node, "type") {
      Some(attribute) => attribute,
      None => {
        if !ALLOW_BLANK {
          self.add_offense("`type` attribute required for `<script>` tag.".to_string(), node.location.clone());
        }

        return;
      }
    };

    if type_attribute.value.is_none() {
      self.add_offense(
        "Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.".to_string(),
        type_attribute.location.clone(),
      );

      return;
    }

    let type_value = match get_static_attribute_value(type_attribute) {
      Some(value) => value,
      None => return,
    };

    if type_value.is_empty() {
      self.add_offense(
        "Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.".to_string(),
        type_attribute.location.clone(),
      );

      return;
    }

    if ALLOWED_TYPES.contains(&type_value.as_str()) {
      return;
    }

    let allowed_list = ALLOWED_TYPES.iter().map(|type_name| format!("`{}`", type_name)).collect::<Vec<_>>().join(", ");

    let blank_suffix = if ALLOW_BLANK { " or blank" } else { "" };

    self.add_offense(
      format!(
        "Avoid using `{}` as the `type` attribute for the `<script>` tag. Must be one of: {}{}.",
        type_value, allowed_list, blank_suffix
      ),
      type_attribute.location.clone(),
    );
  }
}
