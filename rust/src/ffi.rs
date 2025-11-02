pub use crate::bindings::{
  hb_array_T as HbArray, hb_string_T as HbString, herb_extract_language_T as HerbExtractLanguage,
  location_T as CLocation, position_T as CPosition, range_T as CRange, token_T as CToken,
  AST_DOCUMENT_NODE_T as CDocumentNode,
};

#[repr(C)]
pub struct ParserOptions {
  _private: [u8; 0],
}

pub use crate::bindings::{
  ast_node_free, element_source_to_string, hb_array_get, hb_array_size, herb_extract,
  herb_free_tokens, herb_lex, herb_parse, herb_prism_version, herb_version, token_type_to_string,
};
