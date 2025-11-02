use std::os::raw::{c_char, c_uint, c_void};

#[repr(C)]
#[derive(Copy, Clone)]
pub struct CPosition {
  pub line: u32,
  pub column: u32,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct CRange {
  pub from: u32,
  pub to: u32,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct CLocation {
  pub start: CPosition,
  pub end: CPosition,
}

#[repr(C)]
pub struct CToken {
  pub value: *mut c_char,
  pub range: CRange,
  pub location: CLocation,
  pub token_type: c_uint,
}

#[repr(C)]
pub struct HbArray {
  pub items: *mut *mut c_void,
  pub size: usize,
  pub capacity: usize,
}

#[repr(C)]
pub struct CDocumentNode {
  _private: [u8; 0],
}

#[repr(C)]
pub struct ParserOptions {
  _private: [u8; 0],
}

#[repr(C)]
pub enum HerbExtractLanguage {
  Ruby = 0,
  Html = 1,
}

#[repr(C)]
pub struct HbString {
  pub data: *mut c_char,
  pub length: u32,
}

extern "C" {
  pub fn herb_lex(source: *const c_char) -> *mut HbArray;
  pub fn herb_parse(source: *const c_char, options: *mut ParserOptions) -> *mut CDocumentNode;
  pub fn herb_version() -> *const c_char;
  pub fn herb_prism_version() -> *const c_char;
  pub fn herb_free_tokens(tokens: *mut *mut HbArray);

  pub fn hb_array_size(array: *const HbArray) -> usize;
  pub fn hb_array_get(array: *const HbArray, index: usize) -> *mut c_void;

  pub fn token_type_to_string(token_type: c_uint) -> *const c_char;

  pub fn ast_node_free(node: *mut CDocumentNode);

  pub fn herb_extract(source: *const c_char, language: HerbExtractLanguage) -> *mut c_char;

  pub fn element_source_to_string(source: std::os::raw::c_int) -> HbString;
}
