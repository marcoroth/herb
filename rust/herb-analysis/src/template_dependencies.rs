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

      let partial = keywords.partial.as_ref().map(|token| token.value.clone()).filter(|value| !value.is_empty());
      let collection = keywords.collection.as_ref().map(|token| token.value.clone());

      if partial.is_some() {
        self.render_calls.push(RenderCall {
          partial,
          locals,
          collection: collection.clone(),
        });
      }

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

  pub fn with_custom_helpers(helpers: BTreeSet<String>) -> Self {
    Self {
      helper_registry: helper_registry(),
      custom_helpers: helpers,
    }
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

    let mut collector = Collector::new(&self.helper_registry, &self.custom_helpers, BTreeSet::new());
    collector.visit_document_node(&result.value);

    collector.into_dependencies(file)
  }
}

fn helper_registry() -> BTreeSet<String> {
  herb::action_view_helpers::entries().iter().map(|helper| helper.name.to_string()).collect()
}
