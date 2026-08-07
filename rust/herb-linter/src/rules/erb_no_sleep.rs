use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::{is_sleep_call, walk_prism};
use crate::utils::source_slice::location_from_offset;

use herb::ParseResult;
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoSleepRule;

impl Rule for ERBNoSleepRule {
  fn name(&self) -> &'static str {
    "erb-no-sleep"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::PerMode {
      cli: Severity::Error,
      editor: Severity::Info,
    }
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_program: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBNoSleepRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let prism_node = match result.value.prism() {
      Some(prism_node) => prism_node,
      None => return Vec::new(),
    };

    let source = if context.source.is_empty() { &result.source } else { &context.source };

    if source.is_empty() {
      return Vec::new();
    }

    let mut offenses = Vec::new();

    walk_prism(prism_node, &mut |node| {
      if is_sleep_call(node) {
        let call_source = source.get(node.start_offset..node.end_offset).unwrap_or("");

        offenses.push(UnboundOffense::new(
          self.name(),
          format!(
            "Avoid using `{}` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.",
            call_source
          ),
          location_from_offset(source, node.start_offset, node.end_offset),
        ));
      }

      true
    });

    offenses
  }
}
