use std::collections::BTreeMap;

use herb_analysis::render_graph::{PartialCallSite, RenderGraph, TemplateRoots, Verdict};

fn call_site(caller: &str, ancestors: &[&str], locals: &[&str]) -> PartialCallSite {
  PartialCallSite::render(
    caller,
    locals.iter().map(|local| local.to_string()).collect(),
    ancestors.iter().map(|tag| tag.to_string()).collect(),
  )
}

struct Builder {
  graph: RenderGraph,
}

impl Builder {
  fn new() -> Self {
    Self { graph: RenderGraph::new() }
  }

  fn calls(mut self, partial: &str, sites: Vec<PartialCallSite>) -> Self {
    let mut map = BTreeMap::new();
    let caller = sites.first().expect("at least one call site").caller.clone();

    map.insert(partial.to_string(), sites);
    self.graph.replace_calls_from(&caller, map, 0);

    self
  }

  fn document_root(mut self, file: &str) -> Self {
    self.graph.add_document_root(file);

    self
  }

  fn unresolved(mut self, caller: &str, count: usize) -> Self {
    self.graph.replace_calls_from(caller, BTreeMap::new(), count);

    self
  }

  fn roots(mut self, file: &str, roots: TemplateRoots) -> Self {
    self.graph.set_roots(file, roots);

    self
  }

  fn build(self) -> RenderGraph {
    self.graph
  }
}

fn roots(tags: &[&str], conditional: &[&str], renders: &[&str], resolved: bool) -> TemplateRoots {
  TemplateRoots {
    tags: tags.iter().map(|tag| tag.to_string()).collect(),
    conditional_tags: conditional.iter().map(|tag| tag.to_string()).collect(),
    renders: renders.iter().map(|file| file.to_string()).collect(),
    resolved,
  }
}

#[test]
fn reports_unknown_for_a_partial_nothing_renders() {
  let graph = RenderGraph::new();

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&[], &["table"]), Verdict::Unknown);
}

#[test]
fn reports_always_when_every_call_site_is_inside_the_tag() {
  let graph = Builder::new()
    .calls("_row.html.erb", vec![call_site("index.html.erb", &["table", "tbody"], &[])])
    .document_root("index.html.erb")
    .build();

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&[], &["table"]), Verdict::Always);
}

#[test]
fn reports_mixed_when_only_some_call_sites_are_inside_the_tag() {
  let mut graph = RenderGraph::new();
  let mut first = BTreeMap::new();
  first.insert("_row.html.erb".to_string(), vec![call_site("index.html.erb", &["table"], &[])]);
  graph.replace_calls_from("index.html.erb", first, 0);

  let mut second = BTreeMap::new();
  second.insert("_row.html.erb".to_string(), vec![call_site("show.html.erb", &["div"], &[])]);
  graph.replace_calls_from("show.html.erb", second, 0);

  graph.add_document_root("index.html.erb");
  graph.add_document_root("show.html.erb");

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&[], &["table"]), Verdict::Mixed);
}

#[test]
fn reports_never_when_no_call_site_is_inside_the_tag() {
  let graph = Builder::new()
    .calls("_row.html.erb", vec![call_site("show.html.erb", &["div"], &[])])
    .document_root("show.html.erb")
    .build();

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&[], &["table"]), Verdict::Never);
}

#[test]
fn reports_unknown_instead_of_never_when_the_graph_is_incomplete() {
  let graph = Builder::new()
    .calls("_row.html.erb", vec![call_site("index.html.erb", &["div"], &[])])
    .unresolved("index.html.erb", 1)
    .build();

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&[], &["table"]), Verdict::Unknown);
}

#[test]
fn reports_always_from_a_local_ancestor_without_consulting_the_graph() {
  let graph = RenderGraph::new();
  let locals = vec!["table".to_string()];

  assert_eq!(graph.context_of("_row.html.erb").ancestor_verdict(&locals, &["table"]), Verdict::Always);
}

#[test]
fn carries_ancestors_across_two_render_levels() {
  let graph = Builder::new()
    .calls("_cell.html.erb", vec![call_site("_row.html.erb", &["tr"], &[])])
    .calls("_row.html.erb", vec![call_site("index.html.erb", &["table", "tbody"], &[])])
    .document_root("index.html.erb")
    .build();

  let context = graph.context_of("_cell.html.erb");

  assert_eq!(context.chains.len(), 1);
  assert_eq!(context.chains[0].tags, vec!["table", "tbody", "tr"]);
  assert_eq!(context.ancestor_verdict(&[], &["table"]), Verdict::Always);
}

#[test]
fn does_not_loop_forever_on_a_render_cycle() {
  let graph = Builder::new()
    .calls("a.html.erb", vec![call_site("b.html.erb", &["div"], &[])])
    .calls("b.html.erb", vec![call_site("a.html.erb", &["span"], &[])])
    .build();

  assert!(!graph.context_of("a.html.erb").resolved);
}

#[test]
fn finds_the_innermost_matching_ancestor() {
  let graph = Builder::new()
    .calls("_cell.html.erb", vec![call_site("index.html.erb", &["table", "tbody", "tr"], &[])])
    .document_root("index.html.erb")
    .build();

  assert_eq!(
    graph.context_of("_cell.html.erb").closest_ancestor(&[], &["tr", "table"]),
    Some("tr".to_string())
  );
}

#[test]
fn infers_a_signature_from_the_locals_each_call_site_passes() {
  let mut graph = RenderGraph::new();

  let mut first = BTreeMap::new();
  first.insert("_card.html.erb".to_string(), vec![call_site("a.html.erb", &[], &["title", "body"])]);
  graph.replace_calls_from("a.html.erb", first, 0);

  let mut second = BTreeMap::new();
  second.insert("_card.html.erb".to_string(), vec![call_site("b.html.erb", &[], &["title", "footer"])]);
  graph.replace_calls_from("b.html.erb", second, 0);

  let signature = graph.infer_signature("_card.html.erb");

  assert_eq!(
    signature.locals.iter().map(|local| local.name.as_str()).collect::<Vec<_>>(),
    vec!["body", "footer", "title"]
  );
  assert_eq!(signature.call_site_count, 2);
  assert_eq!(signature.strict_locals_declaration(), "<%# locals: (body: nil, footer: nil, title: nil) %>");
}

#[test]
fn adds_a_keyword_rest_to_the_signature_when_the_graph_is_incomplete() {
  let graph = Builder::new()
    .calls("_card.html.erb", vec![call_site("a.html.erb", &[], &["title"])])
    .unresolved("a.html.erb", 1)
    .build();

  assert!(graph.infer_signature("_card.html.erb").strict_locals_declaration().contains("**"));
}

#[test]
fn counts_occurrences_of_a_repeated_chain() {
  let mut graph = RenderGraph::new();

  let mut cell = BTreeMap::new();
  cell.insert("_cell.html.erb".to_string(), vec![call_site("_row.html.erb", &["tr"], &[])]);
  graph.replace_calls_from("_row.html.erb", cell, 0);

  let mut first = BTreeMap::new();
  first.insert("_row.html.erb".to_string(), vec![call_site("index.html.erb", &["table"], &[])]);
  graph.replace_calls_from("index.html.erb", first, 0);

  let mut second = BTreeMap::new();
  second.insert("_row.html.erb".to_string(), vec![call_site("archive.html.erb", &["table"], &[])]);
  graph.replace_calls_from("archive.html.erb", second, 0);

  graph.add_document_root("index.html.erb");
  graph.add_document_root("archive.html.erb");

  let context = graph.context_of("_cell.html.erb");

  assert_eq!(context.chains.len(), 1);
  assert_eq!(context.chains[0].occurrences, 2);
}

#[test]
fn reports_always_for_a_descendant_tag_in_the_partials_own_roots() {
  let graph = Builder::new().roots("_row.html.erb", roots(&["td"], &[], &[], true)).build();

  assert_eq!(graph.descendant_verdict(&["_row.html.erb".to_string()], &["td"]), Verdict::Always);
}

#[test]
fn reports_mixed_for_a_descendant_tag_behind_a_conditional() {
  let graph = Builder::new().roots("_row.html.erb", roots(&[], &["td"], &[], true)).build();

  assert_eq!(graph.descendant_verdict(&["_row.html.erb".to_string()], &["td"]), Verdict::Mixed);
}

#[test]
fn follows_renders_when_deciding_a_descendant_verdict() {
  let graph = Builder::new()
    .roots("_row.html.erb", roots(&[], &[], &["_cell.html.erb"], true))
    .roots("_cell.html.erb", roots(&["td"], &[], &[], true))
    .build();

  assert_eq!(graph.descendant_verdict(&["_row.html.erb".to_string()], &["td"]), Verdict::Always);
}

#[test]
fn reports_unknown_for_a_descendant_when_the_roots_are_unresolved() {
  let graph = Builder::new().roots("_row.html.erb", roots(&[], &[], &[], false)).build();

  assert_eq!(graph.descendant_verdict(&["_row.html.erb".to_string()], &["td"]), Verdict::Unknown);
}
