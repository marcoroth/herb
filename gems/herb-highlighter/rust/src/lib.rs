//! C FFI bindings for the `herb-highlighter` crate.
//!
//! # Safety
//!
//! Every function here requires that pointer arguments are valid, NUL-terminated C strings unless
//! documented as nullable. Returned pointers are owned by the caller and must be released with
//! `herb_highlighter_string_free` or `herb_highlighter_result_free`.

#![allow(clippy::missing_safety_doc)]

mod options;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

use herb_highlighter::{strip_ansi, visible_width, DiagnosticRenderOptions, DiffHunk, DiffRenderOptions, Highlighter, VERSION};

use crate::options::HighlightOptionsInput;

pub struct HerbHighlighter {
  highlighter: Highlighter,
}

#[repr(C)]
pub struct HerbHighlighterHandle {
  pub highlighter: *mut HerbHighlighter,
  pub error: *mut c_char,
}

#[repr(C)]
pub struct HerbHighlighterResult {
  pub value: *mut c_char,
  pub error: *mut c_char,
}

impl HerbHighlighterResult {
  fn ok(value: String) -> Self {
    Self {
      value: into_c_string(value),
      error: ptr::null_mut(),
    }
  }

  fn err(message: impl AsRef<str>) -> Self {
    Self {
      value: ptr::null_mut(),
      error: into_c_string(message.as_ref()),
    }
  }
}

fn into_c_string(value: impl Into<Vec<u8>>) -> *mut c_char {
  CString::new(value).unwrap_or_default().into_raw()
}

unsafe fn borrow_str<'a>(pointer: *const c_char, label: &str) -> Result<&'a str, String> {
  if pointer.is_null() {
    return Err(format!("{label} is null"));
  }

  CStr::from_ptr(pointer).to_str().map_err(|error| format!("Invalid UTF-8 in {label}: {error}"))
}

unsafe fn borrow_str_or_empty<'a>(pointer: *const c_char, label: &str) -> Result<&'a str, String> {
  if pointer.is_null() {
    return Ok("");
  }

  borrow_str(pointer, label)
}

unsafe fn borrow_highlighter<'a>(highlighter: *const HerbHighlighter) -> Result<&'a Highlighter, String> {
  if highlighter.is_null() {
    return Err("highlighter is null".to_string());
  }

  Ok(&(*highlighter).highlighter)
}

unsafe fn parse_options<T: serde::de::DeserializeOwned + Default>(pointer: *const c_char) -> Result<T, String> {
  let json = borrow_str_or_empty(pointer, "options")?;

  if json.trim().is_empty() {
    return Ok(T::default());
  }

  serde_json::from_str(json).map_err(|error| format!("Invalid options: {error}"))
}

macro_rules! try_result {
  ($expression:expr) => {
    match $expression {
      Ok(value) => value,
      Err(error) => return HerbHighlighterResult::err(error),
    }
  };
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_new(theme: *const c_char) -> HerbHighlighterHandle {
  let theme = match borrow_str(theme, "theme") {
    Ok(value) => value,
    Err(error) => {
      return HerbHighlighterHandle {
        highlighter: ptr::null_mut(),
        error: into_c_string(error),
      }
    }
  };

  match Highlighter::new(theme) {
    Ok(highlighter) => HerbHighlighterHandle {
      highlighter: Box::into_raw(Box::new(HerbHighlighter { highlighter })),
      error: ptr::null_mut(),
    },

    Err(error) => HerbHighlighterHandle {
      highlighter: ptr::null_mut(),
      error: into_c_string(error.to_string()),
    },
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_free(highlighter: *mut HerbHighlighter) {
  if !highlighter.is_null() {
    drop(Box::from_raw(highlighter));
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_highlight(
  highlighter: *const HerbHighlighter,
  path: *const c_char,
  content: *const c_char,
  options: *const c_char,
) -> HerbHighlighterResult {
  let highlighter = try_result!(borrow_highlighter(highlighter));
  let path = try_result!(borrow_str_or_empty(path, "path"));
  let content = try_result!(borrow_str(content, "content"));
  let options: HighlightOptionsInput = try_result!(parse_options(options));

  HerbHighlighterResult::ok(highlighter.highlight(path, content, &options.to_options()))
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_highlight_file(
  highlighter: *const HerbHighlighter,
  path: *const c_char,
  options: *const c_char,
) -> HerbHighlighterResult {
  let highlighter = try_result!(borrow_highlighter(highlighter));
  let path = try_result!(borrow_str(path, "path"));
  let options: HighlightOptionsInput = try_result!(parse_options(options));

  match highlighter.highlight_file_from_path(path, &options.to_options()) {
    Ok(value) => HerbHighlighterResult::ok(value),
    Err(error) => HerbHighlighterResult::err(error.to_string()),
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_highlight_diagnostic(
  highlighter: *const HerbHighlighter,
  path: *const c_char,
  diagnostic: *const c_char,
  content: *const c_char,
  options: *const c_char,
) -> HerbHighlighterResult {
  let highlighter = try_result!(borrow_highlighter(highlighter));
  let path = try_result!(borrow_str_or_empty(path, "path"));
  let content = try_result!(borrow_str(content, "content"));
  let diagnostic_json = try_result!(borrow_str(diagnostic, "diagnostic"));

  let diagnostic = match serde_json::from_str(diagnostic_json) {
    Ok(value) => value,
    Err(error) => return HerbHighlighterResult::err(format!("Invalid diagnostic: {error}")),
  };

  let options: DiagnosticRenderOptions = try_result!(parse_options(options));

  HerbHighlighterResult::ok(highlighter.highlight_diagnostic(path, &diagnostic, content, &options))
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_highlight_diff(
  highlighter: *const HerbHighlighter,
  path: *const c_char,
  original: *const c_char,
  modified: *const c_char,
  options: *const c_char,
) -> HerbHighlighterResult {
  let highlighter = try_result!(borrow_highlighter(highlighter));
  let path = try_result!(borrow_str_or_empty(path, "path"));
  let original = try_result!(borrow_str(original, "original"));
  let modified = try_result!(borrow_str(modified, "modified"));
  let options: DiffRenderOptions = try_result!(parse_options(options));

  HerbHighlighterResult::ok(highlighter.highlight_diff(path, original, modified, &options))
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_highlight_diff_hunks(
  highlighter: *const HerbHighlighter,
  path: *const c_char,
  hunks: *const c_char,
  options: *const c_char,
) -> HerbHighlighterResult {
  let highlighter = try_result!(borrow_highlighter(highlighter));
  let path = try_result!(borrow_str_or_empty(path, "path"));
  let hunks_json = try_result!(borrow_str(hunks, "hunks"));

  let hunks: Vec<DiffHunk> = match serde_json::from_str(hunks_json) {
    Ok(value) => value,
    Err(error) => return HerbHighlighterResult::err(format!("Invalid hunks: {error}")),
  };

  let options: DiffRenderOptions = try_result!(parse_options(options));

  HerbHighlighterResult::ok(highlighter.highlight_diff_hunks(path, &hunks, &options))
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_theme_names() -> *mut c_char {
  let names = herb_highlighter::get_theme_names();

  into_c_string(serde_json::to_string(names).unwrap_or_else(|_| "[]".to_string()))
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_default_theme() -> *mut c_char {
  into_c_string(herb_highlighter::get_default_theme().as_str())
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_valid_theme(theme: *const c_char) -> bool {
  match borrow_str(theme, "theme") {
    Ok(value) => herb_highlighter::is_valid_theme(value),
    Err(_) => false,
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_strip_ansi(text: *const c_char) -> *mut c_char {
  match borrow_str(text, "text") {
    Ok(value) => into_c_string(strip_ansi(value)),
    Err(_) => ptr::null_mut(),
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_visible_width(text: *const c_char) -> usize {
  match borrow_str(text, "text") {
    Ok(value) => visible_width(value),
    Err(_) => 0,
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_version() -> *mut c_char {
  into_c_string(VERSION)
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_string_free(value: *mut c_char) {
  if !value.is_null() {
    drop(CString::from_raw(value));
  }
}

#[no_mangle]
pub unsafe extern "C" fn herb_highlighter_result_free(result: HerbHighlighterResult) {
  herb_highlighter_string_free(result.value);
  herb_highlighter_string_free(result.error);
}
