#[repr(C)]
pub struct ParserOptions {
  _private: [u8; 0],
}

pub use crate::bindings::{
  ast_node_free, element_source_to_string, hb_array_get, hb_array_size, hb_string_T, herb_extract,
  herb_free_tokens, herb_lex, herb_parse, herb_prism_version, herb_version, token_type_to_string,
};
