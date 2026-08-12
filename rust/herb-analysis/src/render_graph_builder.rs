use std::collections::BTreeMap;
use std::fs;

use herb::herb::{parse_with_options, ParserOptions};
use herb::nodes::{AnyNode, ERBCaseNode, ERBIfNode, ERBRenderNode, ERBUnlessNode, ERBYieldNode, HTMLElementNode};
use herb::visitor::Visitor;

use crate::partial_index::PartialIndex;
use crate::partial_resolution::{layout_candidates_for, outranks_template, partial_path, template_name_for, LAYOUTS_DIRECTORY};
use crate::render_graph::{CallSiteLocation, PartialCallSite, RenderGraph, StaticAttributeMap, TemplateRoots};

const RENDER_MARKER: &str = "render";
const YIELD_MARKER: &str = "yield";
const DOCUMENT_ROOT_TAG: &str = "html";
const ANCESTOR_CONTEXT_ATTRIBUTES: [&str; 1] = ["class"];

pub struct CollectedCallSites {
  pub unresolved: usize,
  pub document_root: bool,
  pub roots: TemplateRoots,
  pub yields: Vec<YieldSite>,
}

#[derive(Debug, Clone)]
pub struct YieldSite {
  pub ancestors: Vec<String>,
  pub ancestor_attributes: Option<Vec<StaticAttributeMap>>,
  pub location: Option<CallSiteLocation>,
}

struct StackEntry {
  tag_name: String,
  attributes: StaticAttributeMap,
}

#[derive(Default)]
struct ScanState {
  sites: Vec<RenderSite>,
  yields: Vec<YieldSite>,
  stack: Vec<StackEntry>,
  tags: Vec<String>,
  conditional_tags: Vec<String>,
  renders: Vec<String>,
  document_root: bool,
  conditional_depth: usize,
  roots_resolved: bool,
}

struct RenderSite {
  partial: Option<String>,
  locals: Vec<String>,
  ancestors: Vec<String>,
  ancestor_attributes: Option<Vec<StaticAttributeMap>>,
  location: Option<CallSiteLocation>,
}

pub struct Builder<'a> {
  partials: &'a mut PartialIndex,
  resolve_layouts: bool,
}

impl<'a> Builder<'a> {
  pub fn new(partials: &'a mut PartialIndex) -> Self {
    Self {
      partials,
      resolve_layouts: true,
    }
  }

  pub fn with_layouts(partials: &'a mut PartialIndex, resolve_layouts: bool) -> Self {
    Self { partials, resolve_layouts }
  }

  pub fn collect_call_sites(&mut self, file: &str, source: &str, call_sites: &mut BTreeMap<String, Vec<PartialCallSite>>) -> CollectedCallSites {
    let renders_nothing = !source.contains(RENDER_MARKER) && !source.contains(YIELD_MARKER);

    if renders_nothing && !partial_path(file) {
      return CollectedCallSites {
        unresolved: 0,
        document_root: false,
        roots: TemplateRoots::default(),
        yields: Vec::new(),
      };
    }

    let Some(scanned) = scan_source(source) else {
      return CollectedCallSites {
        unresolved: 0,
        document_root: false,
        roots: TemplateRoots::default(),
        yields: Vec::new(),
      };
    };

    let mut unresolved = 0;

    for site in &scanned.sites {
      let Some(name) = &site.partial else {
        unresolved += 1;

        continue;
      };

      let Some(declaration) = self.partials.lookup(name, Some(file)) else {
        unresolved += 1;

        continue;
      };

      let target = declaration.file.clone();

      call_sites.entry(target).or_default().push(PartialCallSite {
        caller: file.to_string(),
        locals: site.locals.clone(),
        ancestors: site.ancestors.clone(),
        ancestor_attributes: site.ancestor_attributes.clone(),
        via: "render".to_string(),
        location: site.location,
      });
    }

    let mut root_renders = Vec::new();
    let mut roots_resolved = scanned.roots_resolved;

    for name in &scanned.renders {
      match self.partials.lookup(name, Some(file)) {
        Some(declaration) => root_renders.push(declaration.file.clone()),
        None => roots_resolved = false,
      }
    }

    CollectedCallSites {
      unresolved,
      document_root: scanned.document_root,
      roots: TemplateRoots {
        tags: scanned.tags.clone(),
        conditional_tags: scanned.conditional_tags.clone(),
        renders: root_renders,
        resolved: roots_resolved,
      },
      yields: scanned.yields.clone(),
    }
  }

  pub fn build(&mut self, templates: &[String]) -> RenderGraph {
    let mut graph = RenderGraph::new();
    let mut layout_yields: BTreeMap<String, Vec<YieldSite>> = BTreeMap::new();
    let mut scanned: Vec<String> = Vec::new();

    for file in templates {
      let Ok(source) = fs::read_to_string(file) else {
        graph.skip(file);

        continue;
      };

      let mut sites = BTreeMap::new();
      let collected = self.collect_call_sites(file, &source, &mut sites);

      graph.replace_calls_from(file, sites, collected.unresolved);
      graph.set_roots(file, collected.roots);

      if collected.document_root {
        graph.add_document_root(file);
      }

      if !collected.yields.is_empty() {
        layout_yields.insert(file.clone(), collected.yields);
      }

      scanned.push(file.clone());
    }

    if self.resolve_layouts {
      self.add_layout_call_sites(&scanned, &layout_yields, &mut graph);
    }

    graph
  }

  fn add_layout_call_sites(&self, files: &[String], layout_yields: &BTreeMap<String, Vec<YieldSite>>, graph: &mut RenderGraph) {
    let Some(view_root) = self.partials.view_root().to_str() else {
      return;
    };

    let mut layouts: BTreeMap<String, String> = BTreeMap::new();

    for file in files {
      let Some(name) = template_name_for(file, view_root) else {
        continue;
      };

      if !layout_yields.contains_key(file) {
        continue;
      }

      match layouts.get(&name) {
        Some(existing) if !outranks_template(file, existing) => continue,
        _ => {
          layouts.insert(name, file.clone());
        }
      }
    }

    for file in files {
      for candidate in layout_candidates_for(file, view_root) {
        let Some(layout) = layouts.get(&candidate) else {
          continue;
        };

        if layout == file {
          continue;
        }

        let Some(sites) = layout_yields.get(layout) else {
          continue;
        };

        let mut additions = BTreeMap::new();

        additions.insert(
          file.clone(),
          sites
            .iter()
            .map(|site| PartialCallSite {
              caller: layout.clone(),
              locals: Vec::new(),
              ancestors: site.ancestors.clone(),
              ancestor_attributes: site.ancestor_attributes.clone(),
              via: "layout".to_string(),
              location: site.location,
            })
            .collect(),
        );

        merge_call_sites(graph, additions);

        break;
      }
    }
  }
}

fn merge_call_sites(graph: &mut RenderGraph, additions: BTreeMap<String, Vec<PartialCallSite>>) {
  for (partial_file, sites) in additions {
    let mut existing: Vec<PartialCallSite> = graph.callers_of(&partial_file).to_vec();
    existing.extend(sites);

    let mut map = BTreeMap::new();
    map.insert(partial_file.clone(), existing);

    graph.remove_calls_to(&partial_file);
    graph.replace_calls_from("__layout__", map, 0);
  }
}

fn scan_source(source: &str) -> Option<ScanState> {
  let options = ParserOptions {
    render_nodes: true,
    prism_nodes: true,
    action_view_helpers: true,
    ..Default::default()
  };

  let result = parse_with_options(source, &options).ok()?;

  let mut scanner = Scanner {
    state: ScanState {
      roots_resolved: true,
      ..Default::default()
    },
  };
  scanner.visit_document_node(&result.value);

  Some(scanner.state)
}

struct Scanner {
  state: ScanState,
}

impl Scanner {
  fn ancestors(&self) -> Vec<String> {
    self.state.stack.iter().map(|entry| entry.tag_name.clone()).collect()
  }

  fn ancestor_attributes(&self) -> Option<Vec<StaticAttributeMap>> {
    let attributes: Vec<StaticAttributeMap> = self.state.stack.iter().map(|entry| entry.attributes.clone()).collect();

    if attributes.iter().any(|attribute| !attribute.is_empty()) {
      Some(attributes)
    } else {
      None
    }
  }
}

impl Visitor for Scanner {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.clone()) else {
      self.walk_html_element_node(node);

      return;
    };

    if self.state.stack.is_empty() {
      if self.state.conditional_depth > 0 {
        self.state.conditional_tags.push(tag_name.clone());
      } else {
        self.state.tags.push(tag_name.clone());
      }
    }

    if tag_name == DOCUMENT_ROOT_TAG {
      self.state.document_root = true;
    }

    self.state.stack.push(StackEntry {
      tag_name,
      attributes: static_ancestor_attributes(node),
    });
    self.walk_html_element_node(node);
    self.state.stack.pop();
  }

  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    let partial = partial_name_rendered_by(node);

    if self.state.stack.is_empty() {
      match &partial {
        Some(rendered) => self.state.renders.push(rendered.clone()),
        None => self.state.roots_resolved = false,
      }
    }

    self.state.sites.push(RenderSite {
      partial,
      locals: locals_passed_by(node),
      ancestors: self.ancestors(),
      ancestor_attributes: self.ancestor_attributes(),
      location: Some(CallSiteLocation {
        line: node.location.start.line as usize,
        column: node.location.start.column as usize,
      }),
    });

    self.walk_erb_render_node(node);
  }

  fn visit_erb_yield_node(&mut self, node: &ERBYieldNode) {
    let bare = node.content.as_ref().map(|token| token.value.trim() == YIELD_MARKER).unwrap_or(false);

    if bare {
      self.state.yields.push(YieldSite {
        ancestors: self.ancestors(),
        ancestor_attributes: self.ancestor_attributes(),
        location: Some(CallSiteLocation {
          line: node.location.start.line as usize,
          column: node.location.start.column as usize,
        }),
      });
    }

    self.walk_erb_yield_node(node);
  }

  fn visit_erb_if_node(&mut self, node: &ERBIfNode) {
    self.state.conditional_depth += 1;
    self.walk_erb_if_node(node);
    self.state.conditional_depth -= 1;
  }

  fn visit_erb_unless_node(&mut self, node: &ERBUnlessNode) {
    self.state.conditional_depth += 1;
    self.walk_erb_unless_node(node);
    self.state.conditional_depth -= 1;
  }

  fn visit_erb_case_node(&mut self, node: &ERBCaseNode) {
    self.state.conditional_depth += 1;
    self.walk_erb_case_node(node);
    self.state.conditional_depth -= 1;
  }
}

fn partial_name_rendered_by(node: &ERBRenderNode) -> Option<String> {
  let keywords = node.keywords.as_ref()?;
  let partial = keywords.partial.as_ref()?;

  if partial.value.is_empty() {
    return None;
  }

  Some(partial.value.clone())
}

fn locals_passed_by(node: &ERBRenderNode) -> Vec<String> {
  let Some(keywords) = node.keywords.as_ref() else {
    return Vec::new();
  };

  keywords
    .locals
    .iter()
    .filter_map(|local| match local {
      AnyNode::RubyRenderLocalNode(node) => node.name.as_ref().map(|token| token.value.clone()),
      _ => None,
    })
    .collect()
}

fn static_ancestor_attributes(element: &HTMLElementNode) -> StaticAttributeMap {
  let mut attributes = StaticAttributeMap::new();

  let Some(open_tag) = element.open_tag.as_ref() else {
    return attributes;
  };

  let children = match open_tag {
    herb::union_types::ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(node) => &node.children,
    _ => return attributes,
  };

  for child in children {
    let AnyNode::HTMLAttributeNode(attribute) = child else {
      continue;
    };

    let Some(name) = attribute.name.as_ref().and_then(|name| literal_content(&name.children)) else {
      continue;
    };

    if !ANCESTOR_CONTEXT_ATTRIBUTES.contains(&name.as_str()) {
      continue;
    }

    let value = attribute.value.as_ref().and_then(|value| literal_content(&value.children)).unwrap_or_default();

    attributes.insert(name, value);
  }

  attributes
}

fn literal_content(children: &[AnyNode]) -> Option<String> {
  let mut parts = String::new();

  for child in children {
    let AnyNode::LiteralNode(literal) = child else {
      return None;
    };

    parts.push_str(&literal.content);
  }

  Some(parts)
}

pub fn layouts_directory() -> &'static str {
  LAYOUTS_DIRECTORY
}
