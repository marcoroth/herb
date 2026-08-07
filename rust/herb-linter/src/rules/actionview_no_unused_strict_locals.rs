use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;
use crate::utils::prism_utils::walk_prism;

use herb::nodes::{AnyNode, ERBStrictLocalsNode, RubyParameterNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const IGNORED_PREFIX: &str = "_";
const REPORTED_KIND: &str = "keyword";
const LOCAL_ASSIGNS: &str = "local_assigns";
const LOCAL_ASSIGNS_LOOKUPS: &[&str] = &["[]", "fetch", "dig", "key?", "has_key?", "include?", "member?"];

pub struct ActionViewNoUnusedStrictLocalsRule;

impl Rule for ActionViewNoUnusedStrictLocalsRule {
  fn name(&self) -> &'static str {
    "actionview-no-unused-strict-locals"
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
      strict_locals: true,
      prism_program: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

fn symbol_arguments(node: &PrismNode) -> Vec<String> {
  node
    .field_one("arguments")
    .map(|arguments| {
      arguments
        .field("arguments")
        .iter()
        .filter(|argument| argument.is("SymbolNode"))
        .filter_map(|argument| argument.unescaped.clone())
        .collect()
    })
    .unwrap_or_default()
}

fn is_local_assigns_read(node: &PrismNode) -> bool {
  node.is("CallNode") && node.receiver().is_none() && node.name.as_deref() == Some(LOCAL_ASSIGNS)
}

fn is_local_assigns_lookup(node: &PrismNode) -> bool {
  if !node.name.as_deref().is_some_and(|name| LOCAL_ASSIGNS_LOOKUPS.contains(&name)) {
    return false;
  }

  let receiver = match node.receiver() {
    Some(receiver) => receiver,
    None => return false,
  };

  if !is_local_assigns_read(receiver) {
    return false;
  }

  !symbol_arguments(node).is_empty()
}

struct References {
  names: HashSet<String>,
  forwards_every_local: bool,
}

fn collect_references(program: &PrismNode) -> References {
  let mut names = HashSet::new();
  let mut local_assigns_reads = 0usize;
  let mut looked_up_reads = 0usize;

  walk_prism(program, &mut |node| {
    if node.is("CallNode") {
      if node.receiver().is_none() {
        if let Some(name) = node.name.as_deref() {
          names.insert(name.to_string());
        }

        if is_local_assigns_read(node) {
          local_assigns_reads += 1;
        }
      } else if is_local_assigns_lookup(node) {
        names.extend(symbol_arguments(node));
        looked_up_reads += 1;
      }
    }

    if matches!(
      node.node_type.as_str(),
      "LocalVariableReadNode" | "LocalVariableOperatorWriteNode" | "LocalVariableAndWriteNode" | "LocalVariableOrWriteNode"
    ) {
      if let Some(name) = node.name.as_deref() {
        names.insert(name.to_string());
      }
    }

    true
  });

  References {
    names,
    // a bare `local_assigns` read that is not part of a lookup forwards everything
    forwards_every_local: local_assigns_reads > looked_up_reads,
  }
}

fn references_name(source: &str, name: &str) -> bool {
  let is_word = |character: char| character.is_ascii_alphanumeric() || character == '_';
  let mut consumed = 0;

  while let Some(index) = source[consumed..].find(name) {
    let start = consumed + index;
    let end = start + name.len();

    let before_ok = start == 0 || !source[..start].chars().next_back().is_some_and(is_word);
    let after_ok = source[end..].chars().next().is_none_or(|character| !is_word(character));

    if before_ok && after_ok {
      return true;
    }

    consumed = start + 1;
  }

  false
}

struct UnusedStrictLocalsVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  references: HashSet<String>,
}

impl UnusedStrictLocalsVisitor {
  fn is_used_in_default_value(node: &ERBStrictLocalsNode, name: &str) -> bool {
    node.locals.iter().any(|local| match local {
      AnyNode::RubyParameterNode(local) => {
        if local.name.as_ref().map(|token| token.value.as_str()) == Some(name) {
          return false;
        }

        local.default_value.as_ref().is_some_and(|value| references_name(&value.content, name))
      }
      _ => false,
    })
  }

  fn contract_for(local: &RubyParameterNode, name: &str) -> String {
    if local.required {
      format!("Callers have to pass `{name}:` for a value the template never renders.")
    } else {
      format!("Callers can pass `{name}:` for a value the template never renders.")
    }
  }
}

impl Visitor for UnusedStrictLocalsVisitor {
  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    for local in &node.locals {
      let local = match local {
        AnyNode::RubyParameterNode(local) if local.kind == REPORTED_KIND => local,
        _ => continue,
      };

      let name = match local.name.as_ref() {
        Some(name) => &name.value,
        None => continue,
      };

      if name.starts_with(IGNORED_PREFIX) || self.references.contains(name) || Self::is_used_in_default_value(node, name) {
        continue;
      }

      self.offenses.push(UnboundOffense::with_tags(
        self.rule_name,
        format!(
          "Strict local `{name}` is never used in this partial. {} Remove it from the `locals:` declaration and from the call sites.",
          Self::contract_for(local, name)
        ),
        local.location.clone(),
        vec!["unnecessary".to_string()],
      ));
    }

    self.walk_erb_strict_locals_node(node);
  }
}

impl ParserRule for ActionViewNoUnusedStrictLocalsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    // a known file name that is not a partial rules the template out, while an
    // unknown one leaves it in
    if let Some(file_name) = context.file_name.as_deref() {
      if !is_partial_file(file_name) {
        return Vec::new();
      }
    }

    let program = match result.value.prism() {
      Some(program) => program,
      None => return Vec::new(),
    };

    let references = collect_references(program);

    if references.forwards_every_local {
      return Vec::new();
    }

    let mut visitor = UnusedStrictLocalsVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      references: references.names,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
