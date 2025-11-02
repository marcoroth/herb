pub mod ast;
pub mod bindings;
pub mod convert;
pub mod errors;
pub mod ffi;
pub mod herb;
pub mod lex_result;
pub mod location;
pub mod nodes;
pub mod parse_result;
pub mod position;
pub mod range;
pub mod token;

pub use errors::{AnyError, ErrorNode, ErrorType};
pub use herb::{extract_html, extract_ruby, herb_version, lex, parse, prism_version, version};
pub use lex_result::LexResult;
pub use location::Location;
pub use nodes::{AnyNode, Node};
pub use parse_result::ParseResult;
pub use position::Position;
pub use range::Range;
pub use token::Token;

pub const VERSION: &str = "0.7.5";

#[cfg(test)]
mod tests {
  use super::*;
  use crate::nodes::{DocumentNode, HTMLTextNode};

  #[test]
  fn test_tree_inspect() {
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

    assert!(output.contains("@ DocumentNode"));
    assert!(output.contains("children: (1 item)"));
    assert!(output.contains("@ HTMLTextNode"));
    assert!(output.contains("Hello"));
  }
}
