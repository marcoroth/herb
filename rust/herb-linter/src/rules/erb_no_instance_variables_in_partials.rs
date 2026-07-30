use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;
use crate::utils::prism_utils::walk_prism;
use crate::utils::source_slice::location_from_offset;

use herb::ParseResult;
use herb_config::{Severity, SeverityConfig};

pub struct ERBNoInstanceVariablesInPartialsRule;

const WRITE_NODES: &[&str] = &[
  "InstanceVariableWriteNode",
  "InstanceVariableAndWriteNode",
  "InstanceVariableOrWriteNode",
  "InstanceVariableOperatorWriteNode",
  "InstanceVariableTargetNode",
];

impl Rule for ERBNoInstanceVariablesInPartialsRule {
  fn name(&self) -> &'static str {
    "erb-no-instance-variables-in-partials"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.9.0")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      track_whitespace: true,
      prism_program: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for ERBNoInstanceVariablesInPartialsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    if !context.file_name.as_deref().map(is_partial_file).unwrap_or(false) {
      return Vec::new();
    }

    let prism_node = match result.value.prism_node_ast {
      Some(ref prism_node) => prism_node,
      None => return Vec::new(),
    };

    let source = if context.source.is_empty() { &result.source } else { &context.source };

    if source.is_empty() {
      return Vec::new();
    }

    let mut offenses = Vec::new();

    walk_prism(prism_node, &mut |node| {
      let is_read = node.is("InstanceVariableReadNode");
      let is_write = WRITE_NODES.contains(&node.node_type.as_str());

      if is_read || is_write {
        let name = node.name.clone().unwrap_or_default();

        let message = if is_read {
          format!("Avoid using instance variables in partials. Pass `{}` as a local variable instead.", name)
        } else {
          format!("Avoid setting instance variables in partials. Use a local variable instead of `{}`.", name)
        };

        offenses.push(UnboundOffense::new(
          self.name(),
          message,
          location_from_offset(source, node.start_offset, node.end_offset),
        ));
      }

      true
    });

    offenses
  }
}
