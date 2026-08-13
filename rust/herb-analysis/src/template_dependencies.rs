use std::collections::{BTreeMap, BTreeSet};

use herb::herb::{parse_with_options, ParserOptions};
use herb::nodes::{AnyNode, ERBRenderNode, ERBStrictLocalsNode};
use herb::visitor::Visitor;

pub const INSTANCE_VARIABLE_READ: &str = "InstanceVariableReadNode";
pub const CONSTANT_READ: &str = "ConstantReadNode";
pub const CALL_NODE: &str = "CallNode";
pub const LOCAL_VARIABLE_READ: &str = "LocalVariableReadNode";
pub const REQUIRED_PARAMETER: &str = "RequiredParameterNode";
pub const BLOCK_PARAMETER: &str = "BlockParameterNode";

const LOCAL_WRITE_NODES: [&str; 4] = [
  "LocalVariableWriteNode",
  "LocalVariableOrWriteNode",
  "LocalVariableAndWriteNode",
  "LocalVariableOperatorWriteNode",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderCall {
  pub partial: Option<String>,
  pub locals: BTreeMap<String, String>,
  pub collection: Option<String>,
  pub dynamic_prefix: Option<String>,
  pub dynamic: bool,
  pub layout: Option<String>,
  pub object: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Dependencies {
  pub file: String,
  pub instance_variables: Vec<String>,
  pub constants: Vec<String>,
  pub locals_declared: Vec<String>,
  pub locals_received: BTreeMap<String, String>,
  pub render_calls: Vec<RenderCall>,
  pub helper_calls: Vec<String>,
  pub unknown_calls: Vec<String>,
}

struct Collector<'a> {
  helper_registry: &'a BTreeSet<String>,
  custom_helpers: &'a BTreeSet<String>,
  instance_variables: BTreeSet<String>,
  constants: BTreeSet<String>,
  locals_declared: BTreeSet<String>,
  locals_received: BTreeMap<String, String>,
  helper_calls: BTreeSet<String>,
  unknown_calls: BTreeSet<String>,
  known_locals: BTreeSet<String>,
  render_calls: Vec<RenderCall>,
}

impl<'a> Collector<'a> {
  fn new(helper_registry: &'a BTreeSet<String>, custom_helpers: &'a BTreeSet<String>, locals: BTreeSet<String>) -> Self {
    Self {
      helper_registry,
      custom_helpers,
      instance_variables: BTreeSet::new(),
      constants: BTreeSet::new(),
      locals_declared: BTreeSet::new(),
      locals_received: BTreeMap::new(),
      helper_calls: BTreeSet::new(),
      unknown_calls: BTreeSet::new(),
      known_locals: locals,
      render_calls: Vec::new(),
    }
  }

  fn analyze_expression(&mut self, code: &str) {
    let trimmed = code.trim();

    if trimmed.is_empty() {
      return;
    }

    let source = format!("<%= {} %>", trimmed);
    let options = ParserOptions {
      prism_nodes: true,
      ..Default::default()
    };

    let Ok(result) = parse_with_options(&source, &options) else {
      return;
    };

    let mut nested = Collector::new(self.helper_registry, self.custom_helpers, self.known_locals.clone());
    nested.locals_received = self.locals_received.clone();
    nested.locals_declared = self.locals_declared.clone();
    nested.visit_document_node(&result.value);

    self.instance_variables.extend(nested.instance_variables);
    self.constants.extend(nested.constants);
    self.helper_calls.extend(nested.helper_calls);
    self.unknown_calls.extend(nested.unknown_calls);
    self.known_locals.extend(nested.known_locals);
  }

  fn walk_prism(&mut self, node: &herb::prism::PrismNode) {
    if node.is(INSTANCE_VARIABLE_READ) {
      if let Some(name) = &node.name {
        self.instance_variables.insert(name.clone());
      }
    } else if LOCAL_WRITE_NODES.contains(&node.node_type.as_str()) || node.is(BLOCK_PARAMETER) || node.is(REQUIRED_PARAMETER) || node.is(LOCAL_VARIABLE_READ) {
      if let Some(name) = &node.name {
        self.known_locals.insert(name.clone());
      }
    } else if node.is(CALL_NODE) {
      self.check_call_node(node);
    }

    for child in &node.children {
      self.walk_prism(child);
    }
  }

  fn check_call_node(&mut self, node: &herb::prism::PrismNode) {
    let Some(name) = &node.name else {
      return;
    };

    match node.receiver() {
      None => {
        if self.helper_registry.contains(name) || self.custom_helpers.contains(name) {
          self.helper_calls.insert(name.clone());
        } else if name != "render" && !self.known_locals.contains(name) && !self.locals_received.contains_key(name) && !self.locals_declared.contains(name) {
          self.unknown_calls.insert(name.clone());
        }
      }
      Some(receiver) => {
        if receiver.is(CONSTANT_READ) {
          if let Some(constant) = &receiver.name {
            self.constants.insert(format!("{}.{}", constant, name));
          }
        }
      }
    }
  }

  fn into_dependencies(self, file: &str) -> Dependencies {
    Dependencies {
      file: file.to_string(),
      instance_variables: self.instance_variables.into_iter().collect(),
      constants: self.constants.into_iter().collect(),
      locals_declared: self.locals_declared.into_iter().collect(),
      locals_received: self.locals_received,
      render_calls: self.render_calls,
      helper_calls: self.helper_calls.into_iter().collect(),
      unknown_calls: self.unknown_calls.into_iter().collect(),
    }
  }
}

impl<'a> Visitor for Collector<'a> {
  fn visit_erb_content_node(&mut self, node: &herb::nodes::ERBContentNode) {
    if let Some(prism) = node.prism() {
      let root = prism.clone();

      self.walk_prism(&root);
    }

    self.walk_erb_content_node(node);
  }

  fn visit_erb_strict_locals_node(&mut self, node: &ERBStrictLocalsNode) {
    for local in &node.locals {
      if let AnyNode::RubyParameterNode(parameter) = local {
        if let Some(name) = &parameter.name {
          self.locals_declared.insert(name.value.clone());
          self.known_locals.insert(name.value.clone());
        }
      }
    }

    self.walk_erb_strict_locals_node(node);
  }

  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    if let Some(prism) = node.prism() {
      let root = prism.clone();

      self.walk_prism(&root);
    }

    let mut locals = BTreeMap::new();

    if let Some(keywords) = node.keywords.as_ref() {
      for local in &keywords.locals {
        let AnyNode::RubyRenderLocalNode(render_local) = local else {
          continue;
        };

        let (Some(name), Some(value)) = (render_local.name.as_ref(), render_local.value.as_ref()) else {
          continue;
        };

        let name = name.value.clone();
        let mut expression = value.content.clone();

        if expression == format!("{}:", name) {
          expression = name.clone();
        }

        self.locals_received.insert(name.clone(), expression.clone());
        locals.insert(name, expression.clone());

        self.analyze_expression(&expression);
      }

      let raw = keywords.partial.as_ref().map(|token| token.value.clone()).filter(|value| !value.is_empty());
      let collection = keywords.collection.as_ref().map(|token| token.value.clone());

      // Only consult the prism tree when the parser could not name a partial. Searching it
      // unconditionally also finds interpolation inside a local's value, which would misread
      // `render "posts/card", title: "a #{b}"` as a dynamic render.
      let interpolated_from_prism = if raw.is_none() {
        node.prism().and_then(interpolated_render_prefix)
      } else {
        None
      };
      let interpolated = raw.as_deref().map(|value| value.contains("#{")).unwrap_or(false) || interpolated_from_prism.is_some();
      let partial = if interpolated { None } else { raw.clone() };

      let dynamic_prefix = interpolated_from_prism.or_else(|| raw.as_deref().filter(|_| interpolated).and_then(dynamic_prefix_of));

      let layout = keywords.layout.as_ref().map(|token| token.value.clone()).filter(|value| !value.is_empty());
      let object = keywords.object.as_ref().map(|token| token.value.clone()).filter(|value| !value.is_empty());

      self.render_calls.push(RenderCall {
        partial,
        locals,
        collection: collection.clone(),
        dynamic_prefix,
        dynamic: interpolated,
        layout,
        object,
      });

      if let Some(collection) = collection {
        self.analyze_expression(&collection);
      }
    }

    self.walk_erb_render_node(node);
  }
}

pub struct TemplateDependencies {
  helper_registry: BTreeSet<String>,
  custom_helpers: BTreeSet<String>,
}

impl Default for TemplateDependencies {
  fn default() -> Self {
    Self::new()
  }
}

impl TemplateDependencies {
  pub fn new() -> Self {
    Self {
      helper_registry: helper_registry(),
      custom_helpers: BTreeSet::new(),
    }
  }

  /// Mirrors `Herb::Analysis::TemplateDependencies#scan_helpers!`: every method defined under
  /// `app/helpers` becomes a known helper, so calls to it stop being reported as unknown.
  pub fn add_custom_helper(&mut self, name: String) {
    self.custom_helpers.insert(name);
  }

  pub fn scan_helpers(&mut self, project_path: &std::path::Path) -> &BTreeSet<String> {
    let helpers = project_path.join("app").join("helpers");

    if helpers.is_dir() {
      let mut found = BTreeSet::new();

      collect_helper_methods(&helpers, &mut found);

      self.custom_helpers.extend(found);
    }

    &self.custom_helpers
  }

  pub fn with_custom_helpers(helpers: BTreeSet<String>) -> Self {
    Self {
      helper_registry: helper_registry(),
      custom_helpers: helpers,
    }
  }

  pub fn analyze_source_with(&self, file: &str, source: &str, extra_helpers: &BTreeSet<String>) -> Dependencies {
    let mut analyzer = Self {
      helper_registry: self.helper_registry.clone(),
      custom_helpers: self.custom_helpers.clone(),
    };

    analyzer.custom_helpers.extend(extra_helpers.iter().cloned());
    analyzer.analyze_source(file, source)
  }

  pub fn analyze_source(&self, file: &str, source: &str) -> Dependencies {
    let options = ParserOptions {
      render_nodes: true,
      strict_locals: true,
      prism_nodes: true,
      track_whitespace: true,
      ..Default::default()
    };

    let Ok(result) = parse_with_options(source, &options) else {
      return Dependencies {
        file: file.to_string(),
        ..Default::default()
      };
    };

    let mut collector = Collector::new(&self.helper_registry, &self.custom_helpers, guarded_locals(source));
    collector.visit_document_node(&result.value);

    collector.into_dependencies(file)
  }
}

/// `<% if defined?(sponsor) %>` is how a partial declares an optional local, so the name is a local
/// the caller may omit rather than a method the template is missing.
fn guarded_locals(source: &str) -> BTreeSet<String> {
  let mut names = BTreeSet::new();
  let mut rest = source;

  while let Some(index) = rest.find("defined?") {
    rest = &rest[index + "defined?".len()..];

    let candidate = rest.trim_start().trim_start_matches('(').trim_start();
    let name: String = candidate.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '_').collect();

    if !name.is_empty() && name.chars().next().is_some_and(|c| c.is_ascii_lowercase() || c == '_') {
      names.insert(name);
    }
  }

  names
}

fn helper_registry() -> BTreeSet<String> {
  // A helper is callable by every name it answers to: `l` is `localize`, `t` is `translate`.
  herb::action_view_helpers::entries()
    .iter()
    .flat_map(|helper| std::iter::once(helper.name.to_string()).chain(helper.aliases.iter().map(|alias| alias.to_string())))
    .collect()
}

fn dynamic_prefix_of(value: &str) -> Option<String> {
  // The `render partial:` form hands back the source text, quotes included.
  let value = value.trim_start_matches(['"', '\'']);
  let head = value.split("#{").next()?.trim_end_matches('/');

  if head.is_empty() {
    None
  } else {
    Some(head.to_string())
  }
}

fn interpolated_render_prefix(node: &herb::prism::PrismNode) -> Option<String> {
  if node.is("InterpolatedStringNode") {
    let first = node.children.first()?;

    if first.is("StringNode") {
      return first.unescaped.as_deref().and_then(dynamic_prefix_of);
    }

    return None;
  }

  node.children.iter().find_map(interpolated_render_prefix)
}

/// Rails resolves `render @post` through `to_partial_path`, which for a model named `Post` is
/// `posts/post`. The variable name is the only signal available statically, so `@post` and
/// `@posts` both point at `posts/post`.
pub fn object_partial_name(expression: &str) -> Option<String> {
  let name = expression.trim().trim_start_matches('@');

  if name.is_empty() || !name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
    return None;
  }

  let singular = name.strip_suffix('s').filter(|rest| !rest.is_empty()).unwrap_or(name);
  let plural = if name.ends_with('s') { name.to_string() } else { format!("{name}s") };

  Some(format!("{plural}/{singular}"))
}

fn collect_helper_methods(directory: &std::path::Path, found: &mut BTreeSet<String>) {
  let Ok(entries) = std::fs::read_dir(directory) else {
    return;
  };

  for entry in entries.flatten() {
    let path = entry.path();

    if path.is_dir() {
      collect_helper_methods(&path, found);

      continue;
    }

    if path.extension().and_then(|extension| extension.to_str()) != Some("rb") {
      continue;
    }

    if let Ok(source) = std::fs::read_to_string(&path) {
      collect_definitions(&source, found);
    }
  }
}

pub fn collect_definitions_in(source: &str, found: &mut BTreeSet<String>) {
  collect_definitions(source, found)
}

fn collect_definitions(source: &str, found: &mut BTreeSet<String>) {
  let options = ParserOptions {
    prism_nodes: true,
    ..Default::default()
  };

  let wrapped = format!("<% {source} %>");

  let Ok(result) = herb::herb::parse_with_options(&wrapped, &options) else {
    return;
  };

  for child in &result.value.children {
    if let AnyNode::ERBContentNode(node) = child {
      if let Some(prism) = node.prism() {
        walk_definitions(prism, found);
      }
    }
  }
}

fn walk_definitions(node: &herb::prism::PrismNode, found: &mut BTreeSet<String>) {
  if node.is("DefNode") {
    if let Some(name) = node.name.as_deref() {
      found.insert(name.to_string());
    }
  }

  for child in &node.children {
    walk_definitions(child, found);
  }
}
