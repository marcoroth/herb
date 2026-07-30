use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::element_stack::ElementStack;
use crate::utils::tag_utils::{get_element_static_attribute_value, get_tag_local_name};

use herb::nodes::HTMLElementNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const INTERACTIVE_ELEMENTS: &[&str] = &["a", "button", "input", "select", "summary", "textarea"];

pub struct A11yNestedInteractiveElementsRule;

struct NestedInteractiveElementsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
}

impl NestedInteractiveElementsVisitor {
  fn find_interactive_ancestor(&self, child_tag_name: &str) -> Option<String> {
    for ancestor in self.element_stack.ancestors() {
      if !INTERACTIVE_ELEMENTS.contains(&ancestor) {
        continue;
      }

      if ancestor == "summary" && child_tag_name == "a" {
        continue;
      }

      return Some(ancestor.to_string());
    }

    None
  }
}

impl Visitor for NestedInteractiveElementsVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let tag_name = get_tag_local_name(node);

    let is_hidden_input = tag_name.as_deref() == Some("input") && get_element_static_attribute_value(node, "type").as_deref() == Some("hidden");

    if let Some(ref tag_name) = tag_name {
      if INTERACTIVE_ELEMENTS.contains(&tag_name.as_str()) && !is_hidden_input {
        if let Some(ancestor) = self.find_interactive_ancestor(tag_name) {
          self.offenses.push(UnboundOffense::new(
            self.rule_name,
            format!(
              "Found `<{}>` nested inside of `<{}>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.",
              tag_name, ancestor
            ),
            node.location.clone(),
          ));
        }
      }
    }

    self.element_stack.push_optional(tag_name);
    self.walk_html_element_node(node);
    self.element_stack.pop();
  }
}

impl Rule for A11yNestedInteractiveElementsRule {
  fn name(&self) -> &'static str {
    "a11y-nested-interactive-elements"
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
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

impl ParserRule for A11yNestedInteractiveElementsRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NestedInteractiveElementsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
