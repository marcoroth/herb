use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::tag_utils::{get_attribute_name, get_tag_local_name};

use herb::nodes::{HTMLAttributeNode, HTMLElementNode};
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const UNSUPPORTED_ELEMENTS: &[&str] = &["html", "meta", "script", "style"];

pub struct A11yNoAriaUnsupportedElementsRule;

struct NoAriaUnsupportedElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

impl Visitor for NoAriaUnsupportedElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    self.element_stack.push_optional(get_tag_local_name(node));
    self.walk_html_element_node(node);
    self.element_stack.pop();
  }

  fn visit_html_attribute_node(&mut self, node: &HTMLAttributeNode) {
    let current_tag_name = match self.element_stack.current_tag_name() {
      Some(tag_name) if UNSUPPORTED_ELEMENTS.contains(&tag_name) => tag_name.to_string(),
      _ => return,
    };

    let attribute_name = match get_attribute_name(node) {
      Some(name) => name,
      None => return,
    };

    if !attribute_name.starts_with("aria-") && attribute_name != "role" {
      return;
    }

    self.offenses.push(UnboundOffense::new(
      self.rule_name,
      format!(
        "The `{}` attribute is not supported on the `<{}>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.",
        attribute_name, current_tag_name
      ),
      node.location.clone(),
    ));

    self.walk_html_attribute_node(node);
  }
}

impl Rule for A11yNoAriaUnsupportedElementsRule {
  fn name(&self) -> &'static str {
    "a11y-no-aria-unsupported-elements"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Warning)
  }

  fn default_enabled(&self) -> bool {
    false
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for A11yNoAriaUnsupportedElementsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoAriaUnsupportedElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
