use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::tag_utils::{get_element_attribute, get_tag_local_name, is_javascript_tag_element, open_tag_location};

use herb::nodes::HTMLElementNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Framework, Severity, SeverityConfig};

pub struct HTMLNoInlineScriptElementsRule;

impl Rule for HTMLNoInlineScriptElementsRule {
  fn name(&self) -> &'static str {
    "html-no-inline-script-elements"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_enabled(&self) -> bool {
    false
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

struct NoInlineScriptElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  framework: Option<Framework>,
}

impl NoInlineScriptElementsVisitor {
  fn suggestion(&self) -> &'static str {
    if self.framework == Some(Framework::ActionView) {
      return "Extract the JavaScript into a separate `.js` file and include it with `javascript_include_tag`.";
    }

    "Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline."
  }
}

impl ParserRule for HTMLNoInlineScriptElementsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoInlineScriptElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      framework: context.framework,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}

fn ignored_element_sources() -> [&'static str; 2] {
  [
    "ActionView::Helpers::AssetTagHelper#javascript_include_tag",
    "ActionView::Helpers::JavaScriptHelper#javascript_tag",
  ]
}

fn is_external_script(node: &HTMLElementNode) -> bool {
  get_element_attribute(node, "src").is_some() && node.body.is_empty()
}

fn is_inline_script(node: &HTMLElementNode) -> bool {
  if get_tag_local_name(node).as_deref() != Some("script") {
    return false;
  }

  if !is_javascript_tag_element(node) {
    return false;
  }

  if ignored_element_sources().contains(&node.element_source.as_str()) {
    return false;
  }

  !is_external_script(node)
}

impl Visitor for NoInlineScriptElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if is_inline_script(node) {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!("Avoid inline `<script>` tags. {}", self.suggestion()),
        open_tag_location(node),
      ));
    }

    self.walk_html_element_node(node);
  }
}
