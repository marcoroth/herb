use crate::bindings::{hb_array_T, hb_buffer_T, token_T};
use crate::convert::token_from_c;
use crate::{LexResult, ParseResult};
use std::ffi::CString;

#[derive(Debug, Clone)]
pub struct ParserOptions {
  pub track_whitespace: bool,
  pub analyze: bool,
  pub strict: bool,
}

impl Default for ParserOptions {
  fn default() -> Self {
    Self {
      track_whitespace: false,
      analyze: true,
      strict: true,
    }
  }
}

#[derive(Debug, Clone)]
pub struct ExtractRubyOptions {
  pub semicolons: bool,
  pub comments: bool,
  pub preserve_positions: bool,
}

impl Default for ExtractRubyOptions {
  fn default() -> Self {
    Self {
      semicolons: true,
      comments: false,
      preserve_positions: true,
    }
  }
}

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
  parse_with_options(source, &ParserOptions::default())
}

pub fn parse_with_options(source: &str, options: &ParserOptions) -> Result<ParseResult, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;

    let c_parser_options = crate::bindings::parser_options_T {
      track_whitespace: options.track_whitespace,
      analyze: options.analyze,
      strict: options.strict,
    };

    let ast = crate::ffi::herb_parse(c_source.as_ptr(), &c_parser_options);

    if ast.is_null() {
      return Err("Failed to parse source".to_string());
    }

    let document_node = crate::ast::convert_document_node(ast as *const std::ffi::c_void).ok_or_else(|| "Failed to convert AST".to_string())?;

    let result = ParseResult::new(document_node, source.to_string(), Vec::new(), options);

    crate::ffi::ast_node_free(ast as *mut crate::bindings::AST_NODE_T);

    Ok(result)
  }
}

pub fn extract_ruby(source: &str) -> Result<String, String> {
  extract_ruby_with_options(source, &ExtractRubyOptions::default())
}

pub fn extract_ruby_with_options(source: &str, options: &ExtractRubyOptions) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;

    let mut output: hb_buffer_T = std::mem::zeroed();
    let init_result = crate::ffi::hb_buffer_init(&mut output, source.len());

    if !init_result {
      return Err("Failed to initialize buffer".to_string());
    }

    let c_options = crate::bindings::herb_extract_ruby_options_T {
      semicolons: options.semicolons,
      comments: options.comments,
      preserve_positions: options.preserve_positions,
    };

    crate::ffi::herb_extract_ruby_to_buffer_with_options(c_source.as_ptr(), &mut output, &c_options);

    let c_str = std::ffi::CStr::from_ptr(crate::ffi::hb_buffer_value(&output));
    let rust_str = c_str.to_string_lossy().into_owned();

    libc::free(output.value as *mut std::ffi::c_void);

    Ok(rust_str)
  }
}

pub fn extract_html(source: &str) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;
    let result = crate::ffi::herb_extract(c_source.as_ptr(), crate::bindings::HERB_EXTRACT_LANGUAGE_HTML);

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
