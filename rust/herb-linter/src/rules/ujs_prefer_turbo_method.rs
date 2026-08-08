use std::sync::LazyLock;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::rules::ujs_base::{UJSAttributeDescriptor, UJSAttributeVisitor, UJSKeyword, UJSReplacement};
use crate::utils::action_view_utils::helper_names_for_tags;

use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

static DESCRIPTOR: LazyLock<UJSAttributeDescriptor> = LazyLock::new(|| UJSAttributeDescriptor {
  attribute: "data-method",
  data_key: "method",
  replacement: Some(UJSReplacement {
    attribute: "data-turbo-method",
    option: "data: { turbo_method: ... }",
  }),
  keyword: Some(UJSKeyword {
    name: "method",
    helpers: helper_names_for_tags(&["a"]),
  }),
});

pub struct UJSPreferTurboMethodRule;

impl Rule for UJSPreferTurboMethodRule {
  fn name(&self) -> &'static str {
    "ujs-prefer-turbo-method"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Warning)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for UJSPreferTurboMethodRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let mut visitor = UJSAttributeVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      descriptor: &DESCRIPTOR,
      source,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
