use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

use crate::linter::Linter;
use crate::rule::{LintContext, Rule};
use crate::rules;

use herb_config::{Config, HerbConfigOptions};

unsafe fn parse_config(config_json: *const c_char) -> Config {
  if config_json.is_null() {
    return Config::default();
  }

  let json = match CStr::from_ptr(config_json).to_str() {
    Ok(json) => json,
    Err(_) => return Config::default(),
  };

  let mut value: serde_json::Value = match serde_json::from_str(json) {
    Ok(value) => value,
    Err(_) => return Config::default(),
  };

  let config_version = value
    .as_object_mut()
    .and_then(|object| object.remove("version"))
    .and_then(|version| version.as_str().map(String::from));

  let options: HerbConfigOptions = match serde_json::from_value(value) {
    Ok(options) => options,
    Err(_) => return Config::default(),
  };

  let project_path = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));

  Config::from_object(&options, &project_path, None, config_version).unwrap_or_default()
}

#[repr(C)]
pub struct HerbLintResultT {
  pub json: *mut c_char,
  pub offense_count: usize,
  pub error_count: usize,
  pub warning_count: usize,
  pub info_count: usize,
  pub hint_count: usize,
}

/// # Safety
///
/// - `source` must be a valid null-terminated UTF-8 C string.
/// - `config_json` may be null or a valid null-terminated UTF-8 C string.
/// - `file_name` may be null or a valid null-terminated UTF-8 C string.
/// - The returned pointer must be freed with `herb_lint_result_free`.
#[no_mangle]
pub unsafe extern "C" fn herb_lint(source: *const c_char, config_json: *const c_char, file_name: *const c_char) -> *mut HerbLintResultT {
  if source.is_null() {
    return ptr::null_mut();
  }

  let source_string = match CStr::from_ptr(source).to_str() {
    Ok(value) => value,
    Err(_) => return ptr::null_mut(),
  };

  let config = parse_config(config_json);

  let file_name_string = if file_name.is_null() {
    None
  } else {
    CStr::from_ptr(file_name).to_str().ok().map(String::from)
  };

  let indent_width = config.formatter().and_then(|formatter| formatter.indent_width);

  let framework = config.config.framework;
  let linter = Linter::new(config);
  let context = LintContext {
    file_name: file_name_string,
    indent_width,
    framework,
    ..Default::default()
  };

  let result = linter.lint(source_string, &context);

  let json = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
  let json_cstring = CString::new(json).unwrap_or_default();

  let ffi_result = Box::new(HerbLintResultT {
    json: json_cstring.into_raw(),
    offense_count: result.offenses.len(),
    error_count: result.errors,
    warning_count: result.warnings,
    info_count: result.info,
    hint_count: result.hints,
  });

  Box::into_raw(ffi_result)
}

#[repr(C)]
pub struct HerbAutofixResultT {
  pub json: *mut c_char,
  pub fixed_count: usize,
  pub unfixed_count: usize,
}

/// # Safety
///
/// - `source` must be a valid null-terminated UTF-8 C string.
/// - `config_json` may be null or a valid null-terminated UTF-8 C string.
/// - `file_name` may be null or a valid null-terminated UTF-8 C string.
/// - The returned pointer must be freed with `herb_autofix_result_free`.
#[no_mangle]
pub unsafe extern "C" fn herb_autofix(
  source: *const c_char,
  config_json: *const c_char,
  file_name: *const c_char,
  include_unsafe: bool,
) -> *mut HerbAutofixResultT {
  if source.is_null() {
    return ptr::null_mut();
  }

  let source_string = match CStr::from_ptr(source).to_str() {
    Ok(value) => value,
    Err(_) => return ptr::null_mut(),
  };

  let config = parse_config(config_json);

  let file_name_string = if file_name.is_null() {
    None
  } else {
    CStr::from_ptr(file_name).to_str().ok().map(String::from)
  };

  let indent_width = config.formatter().and_then(|formatter| formatter.indent_width);

  let framework = config.config.framework;
  let linter = Linter::new(config);
  let context = LintContext {
    file_name: file_name_string,
    indent_width,
    framework,
    ..Default::default()
  };

  let result = linter.autofix(source_string, &context, include_unsafe);

  let payload = serde_json::json!({
    "source": result.source,
    "fixed": result.fixed,
    "unfixed": result.unfixed,
  });

  let json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
  let json_cstring = CString::new(json).unwrap_or_default();

  Box::into_raw(Box::new(HerbAutofixResultT {
    json: json_cstring.into_raw(),
    fixed_count: result.fixed.len(),
    unfixed_count: result.unfixed.len(),
  }))
}

/// # Safety
///
/// `result` must be a pointer returned by `herb_autofix`, or null.
#[no_mangle]
pub unsafe extern "C" fn herb_autofix_result_free(result: *mut HerbAutofixResultT) {
  if result.is_null() {
    return;
  }

  let result = Box::from_raw(result);

  if !result.json.is_null() {
    drop(CString::from_raw(result.json));
  }
}

/// # Safety
///
/// `result` must be a pointer returned by `herb_lint`, or null.
#[no_mangle]
pub unsafe extern "C" fn herb_lint_result_free(result: *mut HerbLintResultT) {
  if result.is_null() {
    return;
  }

  let result = Box::from_raw(result);

  if !result.json.is_null() {
    drop(CString::from_raw(result.json));
  }
}

#[no_mangle]
pub extern "C" fn herb_lint_rule_count() -> usize {
  rules::all_rules().len()
}

/// # Safety
///
/// - `count` must be a valid pointer to a `usize`.
/// - The returned array must be freed with `herb_lint_rule_names_free`.
#[no_mangle]
pub unsafe extern "C" fn herb_lint_rule_names(count: *mut usize) -> *mut *mut c_char {
  let all = rules::all_rules();
  let names: Vec<CString> = all.iter().map(|rule| CString::new(rule.name()).unwrap_or_default()).collect();

  if !count.is_null() {
    *count = names.len();
  }

  let mut pointers: Vec<*mut c_char> = names.into_iter().map(|name| name.into_raw()).collect();

  let pointer = pointers.as_mut_ptr();
  std::mem::forget(pointers);
  pointer
}

/// # Safety
///
/// `names` and `count` must match a previous call to `herb_lint_rule_names`.
#[no_mangle]
pub unsafe extern "C" fn herb_lint_rule_names_free(names: *mut *mut c_char, count: usize) {
  if names.is_null() {
    return;
  }

  let pointers = Vec::from_raw_parts(names, count, count);
  for pointer in pointers {
    if !pointer.is_null() {
      drop(CString::from_raw(pointer));
    }
  }
}
