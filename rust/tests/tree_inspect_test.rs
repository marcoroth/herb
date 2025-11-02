use herb::nodes::{AnyNode, DocumentNode, HTMLTextNode, Node};
use herb::{Location, Position};

#[test]
fn test_document_with_text_node() {
  let loc = Location::new(Position::new(1, 0), Position::new(1, 5));

  let text_node = HTMLTextNode {
    node_type: "HTMLTextNode".to_string(),
    location: loc,
    errors: vec![],
    content: "Hello".to_string(),
  };

  let doc_node = DocumentNode {
    node_type: "DocumentNode".to_string(),
    location: Location::new(Position::new(1, 0), Position::new(2, 0)),
    errors: vec![],
    children: vec![AnyNode::HTMLTextNode(text_node)],
  };

  let output = doc_node.tree_inspect();

  println!("Tree inspect output:\n{}", output);

  assert!(output.contains("@ DocumentNode"));
  assert!(output.contains("children: (1 item)"));
  assert!(output.contains("@ HTMLTextNode"));
  assert!(output.contains("content: \"Hello\""));
}
