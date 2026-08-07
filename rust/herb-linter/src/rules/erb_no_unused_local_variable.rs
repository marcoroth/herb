use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::{call_arguments, walk_prism};
use crate::utils::source_slice::location_from_offset;

use herb::prism::PrismNode;
use herb::ParseResult;
use herb_config::{Severity, SeverityConfig};

const IGNORED_PREFIX: &str = "_";

const REFERENCING_WRITES: &[&str] = &["LocalVariableOperatorWriteNode", "LocalVariableAndWriteNode", "LocalVariableOrWriteNode"];

pub struct ERBNoUnusedLocalVariableRule;

impl Rule for ERBNoUnusedLocalVariableRule {
  fn name(&self) -> &'static str {
    "erb-no-unused-local-variable"
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

#[derive(Default)]
struct LocalVariableCollector {
  referenced: HashSet<String>,
  argument_writes: HashSet<usize>,
}

impl LocalVariableCollector {
  fn collect(&mut self, program: &PrismNode) {
    walk_prism(program, &mut |node| {
      if node.is("CallNode") {
        for argument in call_arguments(node) {
          if argument.is("LocalVariableWriteNode") {
            self.argument_writes.insert(argument.start_offset);
          }
        }
      }

      if node.is("LocalVariableReadNode") || REFERENCING_WRITES.contains(&node.node_type.as_str()) {
        if let Some(name) = node.name.clone() {
          self.referenced.insert(name);
        }
      }

      true
    });
  }
}

fn advice_for(collector: &LocalVariableCollector, write: &PrismNode, name: &str) -> String {
  if collector.argument_writes.contains(&write.start_offset) {
    return format!(
      "This assignment sits in an argument list, where it still passes the value positionally. Write `{name}:` if you meant a keyword argument, or drop the `{name} =`."
    );
  }

  format!("Remove the assignment, or prefix it with an underscore as `_{name}` to show it is intentionally unused.")
}

impl ParserRule for ERBNoUnusedLocalVariableRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() { &result.source } else { &context.source };

    let program = match result.value.prism() {
      Some(program) if !source.is_empty() => program,
      _ => return Vec::new(),
    };

    let mut collector = LocalVariableCollector::default();

    collector.collect(program);

    let mut offenses = Vec::new();

    walk_prism(program, &mut |node| {
      if !node.is("LocalVariableWriteNode") {
        return true;
      }

      let name = match node.name.as_deref() {
        Some(name) => name,
        None => return true,
      };

      if name.starts_with(IGNORED_PREFIX) || collector.referenced.contains(name) {
        return true;
      }

      let (start, end) = match node.field_location("name_loc") {
        Some(span) => span,
        None => return true,
      };

      offenses.push(UnboundOffense::with_tags(
        self.name(),
        format!("Local variable `{name}` is assigned but never used. {}", advice_for(&collector, node, name)),
        location_from_offset(source, start, end),
        vec!["unnecessary".to_string()],
      ));

      true
    });

    offenses
  }
}
