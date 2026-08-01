pub mod analysis;
pub mod rails;
pub mod report;

pub use analysis::{Analysis, Ancestry, ChainState};
pub use report::{expected, Diff};

pub fn e2b_link_check(erb: &str, ruby: &str) -> (usize, usize) {
  let parsed = herb::parse(erb).expect("herb parse failed");
  let erb_children = parsed.value.children.len();

  let mut graph = rubydex::model::graph::Graph::new();
  rubydex::indexing::index_source(&mut graph, "file:///e2b.rb", ruby, &rubydex::indexing::LanguageId::Ruby);
  rubydex::resolution::Resolver::new(&mut graph).resolve();

  (erb_children, graph.declarations().len())
}
