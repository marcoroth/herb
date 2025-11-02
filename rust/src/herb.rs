use crate::convert::token_from_c;
use crate::ffi::{CToken, HbArray};
use crate::{LexResult, ParseResult};
use std::ffi::CString;

pub fn lex(source: &str) -> LexResult {
  unsafe {
    let c_source = CString::new(source).expect("Failed to create CString");
    let c_tokens = crate::ffi::herb_lex(c_source.as_ptr());

    if c_tokens.is_null() {
      return LexResult::new(Vec::new());
    }

    let array_size = crate::ffi::hb_array_size(c_tokens);
    let mut tokens = Vec::with_capacity(array_size);

    for i in 0..array_size {
      let c_token = crate::ffi::hb_array_get(c_tokens, i) as *const CToken;

      if !c_token.is_null() {
        tokens.push(token_from_c(c_token));
      }
    }

    let mut c_tokens_ptr = c_tokens;
    crate::ffi::herb_free_tokens(&mut c_tokens_ptr as *mut *mut HbArray);

    LexResult::new(tokens)
  }
}

pub fn parse(source: &str) -> Result<ParseResult, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let ast = crate::ffi::herb_parse(c_source.as_ptr(), std::ptr::null_mut());

    if ast.is_null() {
      return Err("Failed to parse source".to_string());
    }

    let doc_node = crate::ast::convert_document_node(ast as *const std::ffi::c_void)
      .ok_or_else(|| "Failed to convert AST".to_string())?;

    crate::ffi::ast_node_free(ast);

    let tree_inspect = crate::nodes::Node::tree_inspect(&doc_node);

    Ok(ParseResult::new(tree_inspect))
  }
}

pub fn extract_ruby(source: &str) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let result = crate::ffi::herb_extract(c_source.as_ptr(), crate::ffi::HerbExtractLanguage::Ruby);

    if result.is_null() {
      return Ok(String::new());
    }

    let c_str = std::ffi::CStr::from_ptr(result);
    let rust_str = c_str.to_string_lossy().into_owned();

    libc::free(result as *mut std::ffi::c_void);

    Ok(rust_str)
  }
}

pub fn extract_html(source: &str) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let result = crate::ffi::herb_extract(c_source.as_ptr(), crate::ffi::HerbExtractLanguage::Html);

    if result.is_null() {
      return Ok(String::new());
    }

    let c_str = std::ffi::CStr::from_ptr(result);
    let rust_str = c_str.to_string_lossy().into_owned();

    libc::free(result as *mut std::ffi::c_void);

    Ok(rust_str)
  }
}

pub fn herb_version() -> String {
  unsafe {
    let c_str = std::ffi::CStr::from_ptr(crate::ffi::herb_version());
    c_str.to_string_lossy().into_owned()
  }
}

pub fn prism_version() -> String {
  unsafe {
    let c_str = std::ffi::CStr::from_ptr(crate::ffi::herb_prism_version());
    c_str.to_string_lossy().into_owned()
  }
}

pub fn version() -> String {
  format!(
    "herb rust v{}, libprism v{}, libherb v{} (Rust FFI)",
    herb_version(),
    prism_version(),
    herb_version()
  )
}
