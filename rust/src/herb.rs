use crate::bindings::{hb_array_T, token_T};
use crate::convert::token_from_c;
use crate::{LexResult, ParseResult};
use std::ffi::CString;

pub fn lex(source: &str) -> Result<LexResult, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let c_tokens = crate::ffi::herb_lex(c_source.as_ptr());

    if c_tokens.is_null() {
      return Err("Failed to lex source".to_string());
    }

    let array_size = crate::ffi::hb_array_size(c_tokens);
    let mut tokens = Vec::with_capacity(array_size);

    for index in 0..array_size {
      let token_ptr = crate::ffi::hb_array_get(c_tokens, index) as *const token_T;

      if !token_ptr.is_null() {
        tokens.push(token_from_c(token_ptr));
      }
    }

    let mut c_tokens_ptr = c_tokens;
    crate::ffi::herb_free_tokens(&mut c_tokens_ptr as *mut *mut hb_array_T);

    Ok(LexResult::new(tokens))
  }
}

pub fn parse(source: &str) -> Result<ParseResult, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let ast = crate::ffi::herb_parse(c_source.as_ptr(), std::ptr::null_mut());

    if ast.is_null() {
      return Err("Failed to parse source".to_string());
    }

    crate::ffi::herb_analyze_parse_tree(ast, c_source.as_ptr());

    let document_node = crate::ast::convert_document_node(ast as *const std::ffi::c_void)
      .ok_or_else(|| "Failed to convert AST".to_string())?;

    let result = ParseResult::new(document_node, source.to_string(), Vec::new());

    crate::ffi::ast_node_free(ast as *mut crate::bindings::AST_NODE_T);

    Ok(result)
  }
}

pub fn extract_ruby(source: &str) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let result = crate::ffi::herb_extract(
      c_source.as_ptr(),
      crate::bindings::HERB_EXTRACT_LANGUAGE_RUBY,
    );

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
    let result = crate::ffi::herb_extract(
      c_source.as_ptr(),
      crate::bindings::HERB_EXTRACT_LANGUAGE_HTML,
    );

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
