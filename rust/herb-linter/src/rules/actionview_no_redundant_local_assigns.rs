use std::collections::HashMap;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::file_utils::is_partial_file;
use crate::utils::prism_utils::walk_prism;
use crate::utils::source_slice::location_from_offset;

use herb::nodes::{AnyNode, ERBStrictLocalsNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const KEYWORD_KIND: &str = "keyword";
const KEYWORD_REST_KIND: &str = "keyword_rest";
const LOCAL_ASSIGNS: &str = "local_assigns";

const VALUE_LOOKUPS: &[&str] = &["[]", "fetch", "dig"];
const PRESENCE_LOOKUPS: &[&str] = &["key?", "has_key?", "include?", "member?"];

pub struct ActionViewNoRedundantLocalAssignsRule;

impl Rule for ActionViewNoRedundantLocalAssignsRule {
  fn name(&self) -> &'static str {
    "actionview-no-redundant-local-assigns"
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

struct Lookup {
  name: String,
  method: String,
  presence: bool,
  extra_arguments: bool,
  start_offset: usize,
  end_offset: usize,
}

impl Lookup {
  fn source(&self) -> String {
    let argument = if self.extra_arguments {
      format!(":{}, ...", self.name)
    } else {
      format!(":{}", self.name)
    };

    if self.method == "[]" {
      format!("{LOCAL_ASSIGNS}[{argument}]")
    } else {
      format!("{LOCAL_ASSIGNS}.{}({argument})", self.method)
    }
  }
}

#[derive(Default)]
struct StrictLocalsCollector {
  has_declaration: bool,
  has_keyword_rest: bool,
  locals: HashMap<String, bool>,
}

impl Visitor for StrictLocalsCollector {
  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    self.has_declaration = true;

    for local in &node.locals {
      let local = match local {
        AnyNode::RubyParameterNode(local) => local,
        _ => continue,
      };

      if local.kind == KEYWORD_REST_KIND {
        self.has_keyword_rest = true;
        continue;
      }

      if local.kind != KEYWORD_KIND {
        continue;
      }

      if let Some(name) = local.name.as_ref() {
        self.locals.insert(name.value.clone(), local.required);
      }
    }

    self.walk_erb_strict_locals_node(node);
  }
}

fn is_local_assigns_read(node: Option<&PrismNode>) -> bool {
  node.is_some_and(|node| node.is("CallNode") && node.receiver().is_none() && node.name.as_deref() == Some(LOCAL_ASSIGNS))
}

fn lookup_for(node: &PrismNode) -> Option<Lookup> {
  let method = node.name.as_deref()?;
  let presence = PRESENCE_LOOKUPS.contains(&method);

  if !presence && !VALUE_LOOKUPS.contains(&method) {
    return None;
  }

  if !is_local_assigns_read(node.receiver()) {
    return None;
  }

  let arguments = node.field_one("arguments").map(|arguments| arguments.field("arguments")).unwrap_or(&[]);
  let first = arguments.first()?;

  if !first.is("SymbolNode") {
    return None;
  }

  let rest = arguments.len() - 1;

  if (rest > 0 && method != "fetch") || rest > 1 {
    return None;
  }

  Some(Lookup {
    name: first.unescaped.clone()?,
    method: method.to_string(),
    presence,
    extra_arguments: rest > 0,
    start_offset: node.start_offset,
    end_offset: node.end_offset,
  })
}

fn message_for(lookup: &Lookup, declaration: &StrictLocalsCollector) -> Option<String> {
  let source = lookup.source();

  let required = match declaration.locals.get(&lookup.name) {
    Some(required) => *required,
    None => {
      if declaration.has_keyword_rest {
        return None;
      }

      return Some(format!(
        "`{}` is not declared in the `locals:` declaration, so Rails raises if a caller passes it and `{source}` can never find it. Declare `{}:` in the declaration, or remove the lookup.",
        lookup.name, lookup.name
      ));
    }
  };

  if !required {
    return None;
  }

  if lookup.presence {
    return Some(format!(
      "Strict local `{}` is required, so `{source}` is always `true`. Remove the condition, or give `{}` a default value to make it optional.",
      lookup.name, lookup.name
    ));
  }

  Some(format!(
    "Strict local `{}` is already a local variable in this partial, so `{source}` reads back a value that is already in scope. Use `{}` instead.",
    lookup.name, lookup.name
  ))
}

impl ParserRule for ActionViewNoRedundantLocalAssignsRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    if let Some(file_name) = context.file_name.as_deref() {
      if !is_partial_file(file_name) {
        return Vec::new();
      }
    }

    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let program = match result.value.prism() {
      Some(program) if !source.is_empty() => program,
      _ => return Vec::new(),
    };

    let mut declaration = StrictLocalsCollector::default();
    declaration.visit_document_node(&result.value);

    if !declaration.has_declaration {
      return Vec::new();
    }

    let mut offenses = Vec::new();

    walk_prism(program, &mut |node| {
      if node.is("CallNode") {
        if let Some(lookup) = lookup_for(node) {
          if let Some(message) = message_for(&lookup, &declaration) {
            offenses.push(UnboundOffense::with_tags(
              self.name(),
              message,
              location_from_offset(&source, lookup.start_offset, lookup.end_offset),
              vec!["unnecessary".to_string()],
            ));
          }
        }
      }

      true
    });

    offenses
  }
}
