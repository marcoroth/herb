use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::tag_utils::{get_tag_local_name, open_tag_location};

use herb::nodes::HTMLElementNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Framework, Severity, SeverityConfig};

pub struct HTMLNoStyleElementsRule;

impl Rule for HTMLNoStyleElementsRule {
  fn name(&self) -> &'static str {
    "html-no-style-elements"
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

struct NoStyleElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  framework: Option<Framework>,
}

impl NoStyleElementsVisitor {
  fn suggestion(&self) -> &'static str {
    if self.framework == Some(Framework::ActionView) {
      return "Extract the CSS into a separate `.css` file and include it with `stylesheet_link_tag`.";
    }

    "Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline."
  }
}

impl Visitor for NoStyleElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if get_tag_local_name(node).as_deref() == Some("style") {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!("Avoid inline `<style>` tags. {}", self.suggestion()),
        open_tag_location(node),
      ));
    }

    self.walk_html_element_node(node);
  }
}

impl ParserRule for HTMLNoStyleElementsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoStyleElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      framework: context.framework,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
