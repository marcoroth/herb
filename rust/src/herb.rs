use crate::bindings::{hb_array_T, hb_buffer_T, token_T};
use crate::convert::token_from_c;
use crate::{LexResult, ParseResult};
use std::ffi::CString;

#[derive(Debug, Clone)]
pub struct ParserOptions {
  pub track_whitespace: bool,
  pub analyze: bool,
  pub strict: bool,
  pub action_view_helpers: bool,
  pub render_nodes: bool,
  pub prism_nodes: bool,
  pub prism_nodes_deep: bool,
  pub prism_program: bool,
}

impl Default for ParserOptions {
  fn default() -> Self {
    Self {
      track_whitespace: false,
      analyze: true,
      strict: true,
      action_view_helpers: false,
      render_nodes: false,
      prism_nodes: false,
      prism_nodes_deep: false,
      prism_program: false,
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

    let mut allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();

    if !crate::ffi::hb_allocator_init(&mut allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      return Err("Failed to initialize allocator".to_string());
    }

    let c_tokens = crate::ffi::herb_lex(c_source.as_ptr(), &mut allocator);

    if c_tokens.is_null() {
      crate::ffi::hb_allocator_destroy(&mut allocator);
      return Err("Failed to lex source".to_string());
    }

    let array_size = crate::ffi::hb_array_size(c_tokens);
    let mut tokens = Vec::with_capacity(array_size);

    for index in 0..array_size {
      let token_pointer = crate::ffi::hb_array_get(c_tokens, index) as *const token_T;

      if !token_pointer.is_null() {
        tokens.push(token_from_c(token_pointer));
      }
    }

    let mut c_tokens_pointer = c_tokens;
    crate::ffi::herb_free_tokens(&mut c_tokens_pointer as *mut *mut hb_array_T, &mut allocator);
    crate::ffi::hb_allocator_destroy(&mut allocator);

    Ok(LexResult::new(tokens))
  }
}

pub fn parse(source: &str) -> Result<ParseResult, String> {
  parse_with_options(source, &ParserOptions::default())
}

pub fn parse_with_options(source: &str, options: &ParserOptions) -> Result<ParseResult, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;

    let mut allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();

    if !crate::ffi::hb_allocator_init(&mut allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      return Err("Failed to initialize allocator".to_string());
    }

    let c_parser_options = crate::bindings::parser_options_T {
      track_whitespace: options.track_whitespace,
      analyze: options.analyze,
      strict: options.strict,
      action_view_helpers: options.action_view_helpers,
      render_nodes: options.render_nodes,
      prism_program: options.prism_program,
      prism_nodes: options.prism_nodes,
      prism_nodes_deep: options.prism_nodes_deep,
    };

    let ast = crate::ffi::herb_parse(c_source.as_ptr(), &c_parser_options, &mut allocator);

    if ast.is_null() {
      crate::ffi::hb_allocator_destroy(&mut allocator);
      return Err("Failed to parse source".to_string());
    }

    let document_node = crate::ast::convert_document_node(ast as *const std::ffi::c_void).ok_or_else(|| {
      crate::ffi::ast_node_free(ast as *mut crate::bindings::AST_NODE_T, &mut allocator);
      crate::ffi::hb_allocator_destroy(&mut allocator);
      "Failed to convert AST".to_string()
    })?;

    let result = ParseResult::new(document_node, source.to_string(), Vec::new(), options);

    crate::ffi::ast_node_free(ast as *mut crate::bindings::AST_NODE_T, &mut allocator);
    crate::ffi::hb_allocator_destroy(&mut allocator);

    Ok(result)
  }
}

pub struct RubyParseResult {
  pointer: *mut crate::bindings::herb_ruby_parse_result_T,
  _source: CString,
}

impl RubyParseResult {
  pub fn prettyprint(&self) -> String {
    unsafe {
      let mut buffer: crate::ffi::pm_buffer_t = std::mem::zeroed();

      crate::ffi::pm_prettyprint(&mut buffer, &(*self.pointer).parser, (*self.pointer).root);

      let output = if !buffer.value.is_null() && buffer.length > 0 {
        let slice = std::slice::from_raw_parts(buffer.value as *const u8, buffer.length);
        String::from_utf8_lossy(slice).into_owned()
      } else {
        String::new()
      };

      crate::ffi::pm_buffer_free(&mut buffer);

      crate::nodes::prettify_prism_tree(&output)
    }
  }
}

impl Drop for RubyParseResult {
  fn drop(&mut self) {
    if !self.pointer.is_null() {
      unsafe {
        crate::ffi::herb_free_ruby_parse_result(self.pointer);
      }
    }
  }
}

pub fn parse_ruby(source: &str) -> Result<RubyParseResult, String> {
  let c_source = CString::new(source).map_err(|e| e.to_string())?;

  unsafe {
    let result = crate::ffi::herb_parse_ruby(c_source.as_ptr(), source.len());

    if result.is_null() {
      return Err("Failed to parse Ruby source".to_string());
    }

    Ok(RubyParseResult {
      pointer: result,
      _source: c_source,
    })
  }
}

pub fn extract_ruby(source: &str) -> Result<String, String> {
  extract_ruby_with_options(source, &ExtractRubyOptions::default())
}

pub fn extract_ruby_with_options(source: &str, options: &ExtractRubyOptions) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;

    let mut allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();

    if !crate::ffi::hb_allocator_init(&mut allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      return Err("Failed to initialize allocator".to_string());
    }

    let mut output: hb_buffer_T = std::mem::zeroed();

    if !crate::ffi::hb_buffer_init(&mut output, source.len(), &mut allocator) {
      crate::ffi::hb_allocator_destroy(&mut allocator);
      return Err("Failed to initialize buffer".to_string());
    }

    let c_options = crate::bindings::herb_extract_ruby_options_T {
      semicolons: options.semicolons,
      comments: options.comments,
      preserve_positions: options.preserve_positions,
    };

    crate::ffi::herb_extract_ruby_to_buffer_with_options(c_source.as_ptr(), &mut output, &c_options, &mut allocator);

    let c_str = std::ffi::CStr::from_ptr(crate::ffi::hb_buffer_value(&output));
    let rust_str = c_str.to_string_lossy().into_owned();

    crate::ffi::hb_buffer_free(&mut output);
    crate::ffi::hb_allocator_destroy(&mut allocator);

    Ok(rust_str)
  }
}

pub fn extract_html(source: &str) -> Result<String, String> {
  unsafe {
    let c_source = CString::new(source).map_err(|e| e.to_string())?;

    let mut allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();

    if !crate::ffi::hb_allocator_init(&mut allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      return Err("Failed to initialize allocator".to_string());
    }

    let result = crate::ffi::herb_extract(c_source.as_ptr(), crate::bindings::HERB_EXTRACT_LANGUAGE_HTML, &mut allocator);

    if result.is_null() {
      crate::ffi::hb_allocator_destroy(&mut allocator);
      return Ok(String::new());
    }

    let c_str = std::ffi::CStr::from_ptr(result);
    let rust_str = c_str.to_string_lossy().into_owned();

    crate::ffi::hb_allocator_destroy(&mut allocator);

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
