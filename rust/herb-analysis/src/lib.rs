pub mod analysis;
pub mod partial_declaration;
pub mod partial_index;
pub mod partial_resolution;
pub mod project_index;
pub mod rails;
pub mod render_graph;
pub mod render_graph_builder;
pub mod report;
pub mod template_dependencies;

pub use analysis::{Analysis, Ancestry, ChainState};
pub use report::{expected, Diff};

pub fn prism_link_check(erb: &str, ruby: &str) -> (usize, usize) {
  let parsed = herb::parse(erb).expect("herb parse failed");
  let erb_children = parsed.value.children.len();

  let mut graph = rubydex::model::graph::Graph::new();
  rubydex::indexing::index_source(&mut graph, "file:///link_check.rb", ruby, &rubydex::indexing::LanguageId::Ruby);
  rubydex::resolution::Resolver::new(&mut graph).resolve();

  (erb_children, graph.declarations().len())
}
