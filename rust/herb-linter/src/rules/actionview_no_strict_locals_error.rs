use std::sync::Arc;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::walk_prism;

use herb::action_view_partial_index::{PartialDeclaration, PartialIndex};
use herb::nodes::{AnyNode, ERBRenderNode, RubyRenderLocalNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

const LOCALS_KEYWORD: &str = "locals";

pub struct ActionViewNoStrictLocalsErrorRule;

impl Rule for ActionViewNoStrictLocalsErrorRule {
  fn name(&self) -> &'static str {
    "actionview-no-strict-locals-error"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      render_nodes: true,
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

struct NoStrictLocalsErrorVisitor<'rule> {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  file_name: Option<&'rule str>,
  partials: &'rule Arc<PartialIndex>,
}

fn provided_locals(node: &ERBRenderNode) -> Vec<&RubyRenderLocalNode> {
  let keywords = match node.keywords.as_ref() {
    Some(keywords) => keywords,
    None => return Vec::new(),
  };

  keywords
    .locals
    .iter()
    .filter_map(|local| match local {
      AnyNode::RubyRenderLocalNode(local) if local.name.as_ref().is_some_and(|name| !name.value.is_empty()) => Some(local.as_ref()),
      _ => None,
    })
    .collect()
}

fn is_opaque_locals_assoc(node: &PrismNode) -> bool {
  let key = match node.field_one("key") {
    Some(key) if key.is("SymbolNode") => key,
    _ => return false,
  };

  if key.unescaped.as_deref() != Some(LOCALS_KEYWORD) {
    return false;
  }

  !node.field_one("value").is_some_and(|value| value.is("HashNode"))
}

fn forwards_unknown_locals(node: &ERBRenderNode) -> bool {
  let call = match node.prism() {
    Some(call) if call.is("CallNode") => call,
    _ => return true,
  };

  let mut forwards = false;

  walk_prism(call, &mut |current| {
    if forwards {
      return false;
    }

    if current.is("AssocSplatNode") || (current.is("AssocNode") && is_opaque_locals_assoc(current)) {
      forwards = true;

      return false;
    }

    true
  });

  forwards
}

fn list(names: &[String]) -> String {
  match names {
    [only] => only.clone(),
    [first, second] => format!("{first} and {second}"),
    _ => format!("{} and {}", names[..names.len() - 1].join(", "), names[names.len() - 1]),
  }
}

impl<'rule> NoStrictLocalsErrorVisitor<'rule> {
  fn check_render(&mut self, node: &ERBRenderNode) {
    let keywords = match node.keywords.as_ref() {
      Some(keywords) => keywords,
      None => return,
    };

    let partial = match keywords.partial.as_ref() {
      Some(partial) if !partial.value.is_empty() => partial,
      _ => return,
    };

    if keywords.collection.is_some() || keywords.object.is_some() {
      return;
    }

    if forwards_unknown_locals(node) {
      return;
    }

    let declaration = match self.partials.lookup(&partial.value, self.file_name) {
      Some(declaration) if declaration.has_declaration => declaration.clone(),
      _ => return,
    };

    self.check_missing_locals(node, &declaration, &partial.value, partial.location.clone());
    self.check_undeclared_locals(node, &declaration, &partial.value);
  }

  fn check_missing_locals(&mut self, node: &ERBRenderNode, declaration: &PartialDeclaration, partial_name: &str, location: herb::Location) {
    let provided: Vec<String> = provided_locals(node)
      .iter()
      .filter_map(|local| local.name.as_ref().map(|name| name.value.clone()))
      .collect();

    let missing: Vec<String> = declaration
      .locals
      .iter()
      .filter(|local| local.required && !provided.contains(&local.name))
      .map(|local| format!("`{}:`", local.name))
      .collect();

    if missing.is_empty() {
      return;
    }

    let plural = if missing.len() == 1 { "" } else { "s" };
    let pronoun = if missing.len() == 1 { "it" } else { "them" };

    self.offenses.push(UnboundOffense::new(
      self.rule_name,
      format!(
        "The partial `{partial_name}` requires the {} local{plural} to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add {pronoun} to this `render` call.",
        list(&missing)
      ),
      location,
    ));
  }

  fn check_undeclared_locals(&mut self, node: &ERBRenderNode, declaration: &PartialDeclaration, partial_name: &str) {
    if declaration.has_keyword_rest {
      return;
    }

    let undeclared: Vec<(String, herb::Location)> = provided_locals(node)
      .iter()
      .filter_map(|local| local.name.as_ref())
      .filter(|name| !declaration.locals.iter().any(|local| local.name == name.value))
      .map(|name| (name.value.clone(), name.location.clone()))
      .collect();

    for (name, location) in undeclared {
      self.offenses.push(UnboundOffense::new(
        self.rule_name,
        format!(
          "The partial `{partial_name}` does not declare the `{name}:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration."
        ),
        location,
      ));
    }
  }
}

impl<'rule> Visitor for NoStrictLocalsErrorVisitor<'rule> {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.check_render(node);

    self.walk_erb_render_node(node);
  }
}

impl ParserRule for ActionViewNoStrictLocalsErrorRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let partials = match context.partials.as_ref() {
      Some(partials) => partials,
      None => return Vec::new(),
    };

    let mut visitor = NoStrictLocalsErrorVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      file_name: context.file_name.as_deref(),
      partials,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
