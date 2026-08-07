use std::collections::HashMap;
use std::path::Path;

use crate::utils::erb_utils::is_output_render;
use crate::utils::prism_utils::render_partial_expression;

use herb::action_view_partial_callers::{PartialCallSite, PartialCallerIndex};
use herb::action_view_partial_index::PartialIndex;
use herb::action_view_partial_resolution::TEMPLATE_GLOB_PATTERN;
use herb::nodes::{AnyNode, ERBRenderNode};
use herb::Visitor;

const RENDER_MARKER: &str = "render";
const PROJECT_ROOT: &str = ".";

fn parser_options() -> herb::ParserOptions {
  herb::ParserOptions {
    render_nodes: true,
    prism_nodes: true,
    ..Default::default()
  }
}

fn template_patterns(view_root: &str, include: &[String]) -> Vec<String> {
  let base = if view_root == PROJECT_ROOT {
    format!("**/{TEMPLATE_GLOB_PATTERN}")
  } else {
    format!("{view_root}/**/{TEMPLATE_GLOB_PATTERN}")
  };

  std::iter::once(base).chain(include.iter().cloned()).collect()
}

fn templates_in(project_path: &Path, view_root: &str, include: &[String]) -> Vec<String> {
  herb_config::glob::glob(&template_patterns(view_root, include), project_path, &[] as &[String])
}

#[derive(Default)]
struct RenderCollector {
  renders: Vec<ERBRenderNode>,
}

impl Visitor for RenderCollector {
  fn visit_erb_render_node(&mut self, node: &ERBRenderNode) {
    self.renders.push(node.clone());

    self.walk_erb_render_node(node);
  }
}

fn locals_passed_by(node: &ERBRenderNode) -> Vec<String> {
  let keywords = match node.keywords.as_ref() {
    Some(keywords) => keywords,
    None => return Vec::new(),
  };

  keywords
    .locals
    .iter()
    .filter_map(|local| match local {
      AnyNode::RubyRenderLocalNode(local) => local.name.as_ref().map(|name| name.value.clone()).filter(|name| !name.is_empty()),
      _ => None,
    })
    .collect()
}

fn partial_name_rendered_by(node: &ERBRenderNode) -> Option<String> {
  let call = node.prism()?;

  if !is_output_render(node) {
    return None;
  }

  let expression = render_partial_expression(call)?;

  if !expression.node.is("StringNode") {
    return None;
  }

  expression.node.unescaped.clone()
}

pub fn collect_call_sites(partials: &PartialIndex, file: &str, source: &str, call_sites: &mut HashMap<String, Vec<PartialCallSite>>) -> usize {
  if !source.contains(RENDER_MARKER) {
    return 0;
  }

  let result = match herb::parse_with_options(source, &parser_options()) {
    Ok(result) => result,
    Err(_) => return 0,
  };

  let mut collector = RenderCollector::default();
  collector.visit_document_node(&result.value);

  let mut unresolved = 0;

  for node in &collector.renders {
    let name = match partial_name_rendered_by(node) {
      Some(name) => name,
      None => {
        unresolved += 1;
        continue;
      }
    };

    let declaration = match partials.lookup(&name, Some(file)) {
      Some(declaration) => declaration,
      None => {
        unresolved += 1;
        continue;
      }
    };

    call_sites.entry(declaration.file.clone()).or_default().push(PartialCallSite {
      caller: file.to_string(),
      locals: locals_passed_by(node),
    });
  }

  unresolved
}

#[derive(Default)]
pub struct PartialCallerIndexOptions {
  pub include: Vec<String>,
  pub exclude: Vec<String>,
}

pub fn build_partial_caller_index(project_path: &Path, partials: &PartialIndex, options: &PartialCallerIndexOptions) -> PartialCallerIndex {
  let mut files = templates_in(project_path, &partials.view_root, &options.include);
  let mut call_sites: HashMap<String, Vec<PartialCallSite>> = HashMap::new();

  let mut unresolved_renders = 0;
  let mut skipped_files = 0;

  files.sort();

  for file in files {
    if !options.exclude.is_empty() && herb_config::is_path_matching(&file, &options.exclude) {
      skipped_files += 1;
      continue;
    }

    let source = match std::fs::read_to_string(project_path.join(&file)) {
      Ok(source) => source,
      Err(_) => continue,
    };

    unresolved_renders += collect_call_sites(partials, &file, &source, &mut call_sites);
  }

  PartialCallerIndex::new(call_sites, unresolved_renders, skipped_files)
}
