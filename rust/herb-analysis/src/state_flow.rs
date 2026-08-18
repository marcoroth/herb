use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use herb::herb::{parse_with_options, ParserOptions};
use herb::nodes::AnyNode;

use crate::partial_index::PartialIndex;
use crate::template_dependencies::{Dependencies, TemplateDependencies};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AffectedNode {
  pub node_path: Vec<usize>,
  pub kind: String,
  pub expression: Option<String>,
  pub location: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowNode {
  pub file: String,
  pub names: Vec<String>,
  pub via: BTreeMap<String, String>,
  pub nodes: Vec<AffectedNode>,
  pub children: Vec<FlowNode>,
}

pub struct StateFlow {
  project_path: PathBuf,
  dependencies: TemplateDependencies,
  index: PartialIndex,
}

struct Trace {
  entry_point: String,
  affected: BTreeSet<String>,
  state_locals: BTreeMap<String, BTreeSet<String>>,
  edges: BTreeMap<String, Vec<Edge>>,
}

struct Edge {
  partial: String,
  locals: BTreeMap<String, String>,
}

impl StateFlow {
  pub fn new(project_path: &Path) -> Self {
    let mut dependencies = TemplateDependencies::new();

    dependencies.scan_helpers(project_path);

    for name in view_visible_helper_names(project_path) {
      dependencies.add_custom_helper(name);
    }

    Self {
      project_path: project_path.to_path_buf(),
      dependencies,
      index: PartialIndex::build(project_path),
    }
  }

  pub fn analyze(&self, file: &str) -> Dependencies {
    let source = fs::read_to_string(file).unwrap_or_default();

    let component_methods = component_methods_for(file);

    if component_methods.is_empty() {
      self.dependencies.analyze_source(file, &source)
    } else {
      self.dependencies.analyze_source_with(file, &source, &component_methods)
    }
  }

  pub fn project_path(&self) -> &Path {
    &self.project_path
  }

  pub fn index(&self) -> &PartialIndex {
    &self.index
  }

  pub fn affected_nodes(&self, file: &str, state: &str) -> Vec<AffectedNode> {
    let Ok(source) = fs::read_to_string(file) else {
      return Vec::new();
    };

    let options = ParserOptions {
      render_nodes: true,
      strict_locals: true,
      prism_nodes: true,
      track_whitespace: true,
      ..Default::default()
    };

    let Ok(result) = parse_with_options(&source, &options) else {
      return Vec::new();
    };

    let mut affected = Vec::new();
    let mut path = Vec::new();

    for (index, child) in result.value.children.iter().enumerate() {
      path.push(index);
      collect_affected(child, state, &mut path, &mut affected);
      path.pop();
    }

    affected
  }

  pub fn dependency_index(&self, file: &str) -> BTreeMap<String, Vec<AffectedNode>> {
    let result = self.analyze(file);
    let mut index = BTreeMap::new();

    for state in result.instance_variables.iter().chain(result.constants.iter()) {
      let nodes = self.affected_nodes(file, state);

      if !nodes.is_empty() {
        index.insert(state.clone(), nodes);
      }
    }

    index
  }

  pub fn affected_templates(&self, entry_point: &str, state: &str) -> Vec<String> {
    match self.trace(entry_point, state) {
      Some(trace) => trace.affected.into_iter().collect(),
      None => Vec::new(),
    }
  }

  pub fn state_flow(&self, entry_point: &str, state: &str) -> Option<FlowNode> {
    let trace = self.trace(entry_point, state)?;
    let entry = trace.entry_point.clone();

    Some(self.flow_node(&trace, &entry, BTreeMap::new(), &mut BTreeSet::new()))
  }

  fn flow_node(&self, trace: &Trace, file: &str, via: BTreeMap<String, String>, path: &mut BTreeSet<String>) -> FlowNode {
    let names: Vec<String> = trace.state_locals.get(file).map(|set| set.iter().cloned().collect()).unwrap_or_default();

    let mut nodes = Vec::new();
    let mut seen = BTreeSet::new();

    for name in &names {
      for node in self.affected_nodes(file, name) {
        let key = format!("{:?}|{}|{:?}", node.node_path, node.kind, node.expression);

        if seen.insert(key) {
          nodes.push(node);
        }
      }
    }

    path.insert(file.to_string());

    let children = trace
      .edges
      .get(file)
      .map(|edges| {
        edges
          .iter()
          .filter(|edge| !path.contains(&edge.partial))
          .map(|edge| self.flow_node(trace, &edge.partial, edge.locals.clone(), &mut path.clone()))
          .collect()
      })
      .unwrap_or_default();

    FlowNode {
      file: file.to_string(),
      names,
      via,
      nodes,
      children,
    }
  }

  fn trace(&self, entry_point: &str, state: &str) -> Option<Trace> {
    let entry_result = self.analyze(entry_point);

    if !entry_result.instance_variables.iter().any(|name| name == state) && !entry_result.constants.iter().any(|name| name == state) {
      return None;
    }

    let mut affected = BTreeSet::new();
    let mut state_locals: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut edges: BTreeMap<String, Vec<Edge>> = BTreeMap::new();
    let mut analyzed: BTreeMap<String, Dependencies> = BTreeMap::new();

    affected.insert(entry_point.to_string());
    state_locals.entry(entry_point.to_string()).or_default().insert(state.to_string());
    analyzed.insert(entry_point.to_string(), entry_result);

    let mut queue = vec![entry_point.to_string()];
    let mut visited = BTreeSet::new();

    while let Some(file) = queue.pop() {
      if !visited.insert(file.clone()) {
        continue;
      }

      let result = analyzed.entry(file.clone()).or_insert_with(|| self.analyze(&file)).clone();
      let carrying: Vec<String> = state_locals.get(&file).map(|set| set.iter().cloned().collect()).unwrap_or_default();

      for call in &result.render_calls {
        let mut flowing: BTreeMap<String, String> = BTreeMap::new();

        for (local_name, expression) in &call.locals {
          if carrying.iter().any(|name| expression_references(expression, name)) {
            flowing.insert(local_name.clone(), expression.clone());
          }
        }

        let collection_flows = call
          .collection
          .as_ref()
          .map(|collection| carrying.iter().any(|name| expression_references(collection, name)))
          .unwrap_or(false);

        if flowing.is_empty() && !collection_flows {
          continue;
        }

        let Some(name) = &call.partial else {
          continue;
        };

        for partial_file in self.index.resolve(name, Some(&file)) {
          let entry = state_locals.entry(partial_file.clone()).or_default();

          for local_name in flowing.keys() {
            entry.insert(local_name.clone());
          }

          let mut carried = flowing.clone();

          if collection_flows {
            let item = name.rsplit('/').next().unwrap_or(name).to_string();

            entry.insert(item.clone());
            carried.insert(item, call.collection.clone().unwrap_or_default());
          }

          edges.entry(file.clone()).or_default().push(Edge {
            partial: partial_file.clone(),
            locals: carried,
          });

          if affected.insert(partial_file.clone()) {
            queue.push(partial_file.clone());
          }
        }
      }
    }

    Some(Trace {
      entry_point: entry_point.to_string(),
      affected,
      state_locals,
      edges,
    })
  }
}

fn expression_references(expression: &str, name: &str) -> bool {
  let sigil = name.starts_with('@');
  let bytes = expression.as_bytes();
  let mut start = 0;

  while let Some(offset) = expression[start..].find(name) {
    let index = start + offset;
    let before = sigil || index == 0 || !is_word_byte(bytes[index - 1]);
    let after_index = index + name.len();
    let after = after_index >= bytes.len() || !is_word_byte(bytes[after_index]);

    if before && after {
      return true;
    }

    start = index + 1;

    if start >= expression.len() {
      break;
    }
  }

  false
}

fn is_word_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_'
}

fn collect_affected(node: &AnyNode, state: &str, path: &mut Vec<usize>, affected: &mut Vec<AffectedNode>) {
  let kind = match node {
    AnyNode::ERBContentNode(_) => Some("text_content"),
    AnyNode::ERBIfNode(_) => Some("conditional"),
    AnyNode::ERBUnlessNode(_) => Some("conditional"),
    AnyNode::ERBCaseNode(_) => Some("conditional"),
    AnyNode::ERBRenderNode(_) => Some("render"),
    _ => None,
  };

  if let Some(kind) = kind {
    let expressions = collect_expressions(node);

    if expressions.iter().any(|code| references_state(code, state)) {
      let location = node.location();

      affected.push(AffectedNode {
        node_path: path.clone(),
        kind: kind.to_string(),
        expression: expressions.first().cloned(),
        location: Some(format!("{}:{}", location.start.line, location.start.column)),
      });
    }
  }

  if let AnyNode::HTMLElementNode(element) = node {
    collect_attributes(element, state, path, affected);
  }

  for (index, child) in any_children(node).into_iter().enumerate() {
    path.push(index);
    collect_affected(child, state, path, affected);
    path.pop();
  }
}

fn collect_attributes(element: &herb::nodes::HTMLElementNode, state: &str, path: &[usize], affected: &mut Vec<AffectedNode>) {
  let Some(open_tag) = element.open_tag.as_ref() else {
    return;
  };

  let children = match open_tag {
    herb::union_types::ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node) => &node.children,
    _ => return,
  };

  for child in children {
    let AnyNode::HTMLAttributeNode(attribute) = child else {
      continue;
    };

    let Some(value) = attribute.value.as_ref() else {
      continue;
    };

    for value_child in &value.children {
      let Some(code) = content_of(value_child) else {
        continue;
      };

      let trimmed = code.trim();

      if trimmed.is_empty() || !references_state(trimmed, state) {
        continue;
      }

      let location = value_child.location();

      affected.push(AffectedNode {
        node_path: path.to_vec(),
        kind: "attribute_value".to_string(),
        expression: Some(trimmed.to_string()),
        location: Some(format!("{}:{}", location.start.line, location.start.column)),
      });
    }
  }
}

fn any_children(node: &AnyNode) -> Vec<&AnyNode> {
  match node {
    AnyNode::DocumentNode(inner) => inner.children.iter().collect(),
    AnyNode::HTMLElementNode(inner) => inner.body.iter().collect(),
    AnyNode::HTMLAttributeValueNode(inner) => inner.children.iter().collect(),
    AnyNode::ERBIfNode(inner) => inner.statements.iter().collect(),
    AnyNode::ERBUnlessNode(inner) => inner.statements.iter().collect(),
    AnyNode::ERBCaseNode(inner) => inner.children.iter().collect(),
    AnyNode::ERBBlockNode(inner) => inner.body.iter().collect(),
    AnyNode::ERBRenderNode(inner) => inner.body.iter().collect(),
    _ => Vec::new(),
  }
}

fn collect_expressions(node: &AnyNode) -> Vec<String> {
  let mut expressions = Vec::new();

  if let Some(content) = content_of(node) {
    let trimmed = content.trim().to_string();

    if !trimmed.is_empty() {
      expressions.push(trimmed);
    }
  }

  for child in any_children(node) {
    expressions.extend(collect_expressions(child));
  }

  expressions
}

fn content_of(node: &AnyNode) -> Option<String> {
  match node {
    AnyNode::ERBContentNode(inner) => inner.content.as_ref().map(|token| token.value.clone()),
    AnyNode::ERBIfNode(inner) => inner.content.as_ref().map(|token| token.value.clone()),
    AnyNode::ERBUnlessNode(inner) => inner.content.as_ref().map(|token| token.value.clone()),
    AnyNode::ERBCaseNode(inner) => inner.content.as_ref().map(|token| token.value.clone()),
    AnyNode::ERBRenderNode(inner) => inner.content.as_ref().map(|token| token.value.clone()),
    _ => None,
  }
}

fn references_state(code: &str, state: &str) -> bool {
  expression_references(code, state)
}

fn component_methods_for(template: &str) -> std::collections::BTreeSet<String> {
  let mut methods = std::collections::BTreeSet::new();

  let sibling = template
    .strip_suffix(".html.erb")
    .or_else(|| template.strip_suffix(".erb"))
    .map(|stem| format!("{stem}.rb"));

  let Some(sibling) = sibling else {
    return methods;
  };

  if let Ok(source) = fs::read_to_string(&sibling) {
    crate::template_dependencies::collect_definitions_in(&source, &mut methods);
  }

  methods
}

const KERNEL_METHODS: [&str; 24] = [
  "rand",
  "srand",
  "format",
  "sprintf",
  "raise",
  "loop",
  "sleep",
  "catch",
  "throw",
  "block_given?",
  "caller",
  "binding",
  "frozen?",
  "freeze",
  "dup",
  "clone",
  "tap",
  "then",
  "itself",
  "send",
  "public_send",
  "respond_to?",
  "instance_variable_get",
  "instance_variables",
];

fn view_visible_helper_names(project_path: &Path) -> Vec<String> {
  let Some(path) = project_path.to_str() else {
    return Vec::new();
  };

  let mut helper_roots = vec![path.to_string()];
  helper_roots.extend(crate::rails::gem_paths(project_path).paths);

  let (helper_method_names, action_view_modules) = crate::rails::helper_sources(&helper_roots);

  let mut analysis = crate::analysis::Analysis::index_paths(&helper_roots, &std::collections::HashSet::new());
  analysis.resolve();

  let modules = analysis.helper_modules();
  let mut roots: Vec<&str> = modules.iter().map(String::as_str).collect();

  roots.push("ActionView::Base");

  roots.extend(action_view_modules.iter().map(String::as_str));

  let mut names: Vec<String> = analysis.view_visible_helpers(&roots).into_keys().collect();

  names.extend(helper_method_names.into_keys());

  names.extend(KERNEL_METHODS.iter().map(|name| (*name).to_string()));

  names.extend(crate::rails::route_helpers(project_path));

  names
}
