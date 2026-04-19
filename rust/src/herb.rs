use crate::bindings::{hb_array_T, hb_buffer_T, token_T, AST_NODE_T};
use crate::convert::token_from_c;
use crate::{LexResult, ParseResult};
use std::ffi::{CStr, CString};

#[derive(Debug, Clone)]
pub struct ParserOptions {
  pub track_whitespace: bool,
  pub analyze: bool,
  pub strict: bool,
  pub action_view_helpers: bool,
  pub transform_conditionals: bool,
  pub render_nodes: bool,
  pub strict_locals: bool,
  pub prism_nodes: bool,
  pub prism_nodes_deep: bool,
  pub prism_program: bool,
  pub dot_notation_tags: bool,
  pub html: bool,
}

impl Default for ParserOptions {
  fn default() -> Self {
    Self {
      track_whitespace: false,
      analyze: true,
      strict: true,
      action_view_helpers: false,
      transform_conditionals: false,
      render_nodes: false,
      strict_locals: false,
      prism_nodes: false,
      prism_nodes_deep: false,
      prism_program: false,
      dot_notation_tags: false,
      html: true,
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
      transform_conditionals: options.transform_conditionals,
      render_nodes: options.render_nodes,
      strict_locals: options.strict_locals,
      prism_program: options.prism_program,
      prism_nodes: options.prism_nodes,
      prism_nodes_deep: options.prism_nodes_deep,
      dot_notation_tags: options.dot_notation_tags,
      html: options.html,
      start_line: 0,
      start_column: 0,
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

#[derive(Debug, Clone)]
pub struct DiffOperation {
  pub operation_type: String,
  pub path: Vec<u32>,
  pub old_node: Option<crate::nodes::AnyNode>,
  pub new_node: Option<crate::nodes::AnyNode>,
  pub old_index: u32,
  pub new_index: u32,
}

#[derive(Debug, Clone)]
pub struct DiffResult {
  pub identical: bool,
  pub operations: Vec<DiffOperation>,
}

pub fn diff(old_source: &str, new_source: &str) -> Result<DiffResult, String> {
  unsafe {
    let old_c_source = CString::new(old_source).map_err(|error| error.to_string())?;
    let new_c_source = CString::new(new_source).map_err(|error| error.to_string())?;

    let mut old_allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();
    let mut new_allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();
    let mut diff_allocator: crate::ffi::hb_allocator_T = std::mem::zeroed();

    if !crate::ffi::hb_allocator_init(&mut old_allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      return Err("Failed to initialize old allocator".to_string());
    }

    if !crate::ffi::hb_allocator_init(&mut new_allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      crate::ffi::hb_allocator_destroy(&mut old_allocator);
      return Err("Failed to initialize new allocator".to_string());
    }

    if !crate::ffi::hb_allocator_init(&mut diff_allocator, crate::ffi::HB_ALLOCATOR_ARENA) {
      crate::ffi::hb_allocator_destroy(&mut old_allocator);
      crate::ffi::hb_allocator_destroy(&mut new_allocator);
      return Err("Failed to initialize diff allocator".to_string());
    }

    let parser_options = crate::bindings::parser_options_T {
      track_whitespace: false,
      analyze: true,
      strict: true,
      action_view_helpers: false,
      render_nodes: false,
      strict_locals: false,
      prism_program: false,
      prism_nodes: false,
      prism_nodes_deep: false,
      dot_notation_tags: false,
      html: true,
      start_line: 0,
      start_column: 0,
    };

    let old_root = crate::ffi::herb_parse(old_c_source.as_ptr(), &parser_options, &mut old_allocator);
    let new_root = crate::ffi::herb_parse(new_c_source.as_ptr(), &parser_options, &mut new_allocator);

    let diff_result = crate::ffi::herb_diff(old_root, new_root, &mut diff_allocator);

    let identical = crate::ffi::herb_diff_trees_identical(diff_result);
    let operation_count = crate::ffi::herb_diff_operation_count(diff_result);

    let mut operations = Vec::with_capacity(operation_count);

    for index in 0..operation_count {
      let operation = crate::ffi::herb_diff_operation_at(diff_result, index);

      if operation.is_null() {
        continue;
      }

      let operation_ref = &*operation;

      let type_c_str = CStr::from_ptr(crate::ffi::herb_diff_operation_type_to_string(operation_ref.type_));
      let operation_type = type_c_str.to_string_lossy().into_owned();

      let mut path = Vec::with_capacity(operation_ref.path.depth as usize);
      for path_index in 0..operation_ref.path.depth {
        path.push(operation_ref.path.indices[path_index as usize]);
      }

      let old_node = if !operation_ref.old_node.is_null() {
        crate::ast::nodes::convert_node(operation_ref.old_node as *const std::ffi::c_void)
      } else {
        None
      };

      let new_node = if !operation_ref.new_node.is_null() {
        crate::ast::nodes::convert_node(operation_ref.new_node as *const std::ffi::c_void)
      } else {
        None
      };

      operations.push(DiffOperation {
        operation_type,
        path,
        old_node,
        new_node,
        old_index: operation_ref.old_index,
        new_index: operation_ref.new_index,
      });
    }

    crate::ffi::ast_node_free(old_root as *mut AST_NODE_T, &mut old_allocator);
    crate::ffi::ast_node_free(new_root as *mut AST_NODE_T, &mut new_allocator);
    crate::ffi::hb_allocator_destroy(&mut diff_allocator);
    crate::ffi::hb_allocator_destroy(&mut old_allocator);
    crate::ffi::hb_allocator_destroy(&mut new_allocator);

    Ok(DiffResult { identical, operations })
  }
}
