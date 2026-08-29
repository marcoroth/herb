mod common;

use herb::nodes::{AnyNode, ChildNodeList, Node};
use herb::parse;
use herb::visitor::Visitor;

#[derive(Default)]
struct RecordingVisitor {
  lists: Vec<(String, &'static str, &'static [&'static str], bool, usize)>,
}

impl Visitor for RecordingVisitor {
  fn visit_child_node_list(&mut self, list: &ChildNodeList, parent: &dyn Node) {
    self.lists.push((parent.node_type().to_string(), list.name, list.kind, list.content, list.nodes.len()));
  }
}

#[test]
fn test_visits_each_child_node_list_of_every_node() {
  common::no_color();

  let source = "<div><% if true %>a<% else %>b<% end %></div>";
  let result = parse(source).unwrap();

  let mut visitor = RecordingVisitor::default();
  visitor.visit(&AnyNode::DocumentNode(Box::new(result.value.clone())));

  let names: Vec<&str> = visitor.lists.iter().map(|(_, name, _, _, _)| *name).collect();

  assert_eq!(names, vec!["children", "body", "children", "statements", "statements", "children"]);

  assert_eq!(visitor.lists[3].2, &["Node"]);
  assert_eq!(visitor.lists[3].4, 1);
  assert_eq!(visitor.lists[5].2, &["WhitespaceNode"]);
}

#[test]
fn test_child_node_lists_exposes_the_name_and_kind_of_every_array_field() {
  common::no_color();

  let source = "<% items.each do |item| %><%= item %><% end %>";
  let result = parse(source).unwrap();

  let block = &result.value.children[0];

  let lists = block.child_node_lists();
  let names: Vec<&str> = lists.iter().map(|list| list.name).collect();
  let kinds: Vec<&[&str]> = lists.iter().map(|list| list.kind).collect();

  assert_eq!(block.node_type(), "AST_ERB_BLOCK_NODE");
  assert_eq!(names, vec!["body", "block_arguments"]);
  assert_eq!(kinds, vec![&["Node"][..], &["RubyParameterNode"][..]]);
  assert_eq!(lists.iter().map(|list| list.content).collect::<Vec<bool>>(), vec![true, false]);
}

#[test]
fn test_child_node_fields_exposes_every_single_node_field() {
  common::no_color();

  let source = "<div><% if true %>a<% else %>b<% end %></div>";
  let result = parse(source).unwrap();

  let element = &result.value.children[0];
  let conditional = &element.child_node_lists()[0].nodes[0];

  let fields = conditional.child_node_fields();
  let names: Vec<&str> = fields.iter().map(|field| field.name).collect();
  let continuations: Vec<bool> = fields.iter().map(|field| field.continuation).collect();

  assert_eq!(conditional.node_type(), "AST_ERB_IF_NODE");
  assert_eq!(names, vec!["subsequent", "end_node"]);
  assert_eq!(continuations, vec![true, false]);
}
