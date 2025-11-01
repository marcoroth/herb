use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use lightningcss::rules::CssRule;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

#[repr(C)]
pub struct CSSDeclaration {
  pub property: *mut c_char,
  pub value: *mut c_char,
}

#[repr(C)]
pub struct CSSRule {
  pub selector: *mut c_char,
  pub declarations: *mut *mut CSSDeclaration,
  pub declaration_count: usize,
}

#[repr(C)]
pub struct CSSParseResult {
  pub success: bool,
  pub error_message: *mut c_char,
  pub rules: *mut *mut CSSRule,
  pub rule_count: usize,
}

#[no_mangle]
pub unsafe extern "C" fn herb_css_parse(css_input: *const c_char) -> *mut CSSParseResult {
  if css_input.is_null() {
    return create_error_result_ptr("Input CSS is null");
  }

  let c_str = unsafe { CStr::from_ptr(css_input) };
  let css_str = match c_str.to_str() {
    Ok(s) => s,
    Err(_) => {
      return create_error_result_ptr("Invalid UTF-8 in CSS input");
    }
  };

  let result = Box::new(parse_css_to_rules(css_str));
  Box::into_raw(result)
}

#[no_mangle]
pub unsafe extern "C" fn herb_css_validate(css_input: *const c_char) -> bool {
  if css_input.is_null() {
    return false;
  }

  let c_str = unsafe { CStr::from_ptr(css_input) };
  let css_str = match c_str.to_str() {
    Ok(s) => s,
    Err(_) => return false,
  };

  StyleSheet::parse(css_str, ParserOptions::default()).is_ok()
}

#[no_mangle]
pub unsafe extern "C" fn herb_css_free_result(result: *mut CSSParseResult) {
  if result.is_null() {
    return;
  }

  let result = unsafe { Box::from_raw(result) };

  if !result.error_message.is_null() {
    unsafe {
      let _ = CString::from_raw(result.error_message);
    }
  }

  if !result.rules.is_null() {
    unsafe {
      for i in 0..result.rule_count {
        let rule_ptr = *result.rules.offset(i as isize);
        if !rule_ptr.is_null() {
          let rule = Box::from_raw(rule_ptr);
          if !rule.selector.is_null() {
            let _ = CString::from_raw(rule.selector);
          }
          if !rule.declarations.is_null() {
            for j in 0..rule.declaration_count {
              let decl_ptr = *rule.declarations.offset(j as isize);
              if !decl_ptr.is_null() {
                let decl = Box::from_raw(decl_ptr);
                if !decl.property.is_null() {
                  let _ = CString::from_raw(decl.property);
                }
                if !decl.value.is_null() {
                  let _ = CString::from_raw(decl.value);
                }
              }
            }
            let _ = Vec::from_raw_parts(rule.declarations, rule.declaration_count, rule.declaration_count);
          }
        }
      }
      let _ = Vec::from_raw_parts(result.rules, result.rule_count, result.rule_count);
    }
  }
}

fn parse_css_to_rules(css_str: &str) -> CSSParseResult {
  match StyleSheet::parse(css_str, ParserOptions::default()) {
    Ok(stylesheet) => {
      let mut rules_vec: Vec<*mut CSSRule> = Vec::new();

      for rule in &stylesheet.rules.0 {
        if let CssRule::Style(style_rule) = rule {
          let selector_str = format!("{:?}", style_rule.selectors);
          let selector = CString::new(selector_str.trim()).unwrap_or_else(|_| CString::new("").unwrap());

          let mut decls_vec: Vec<*mut CSSDeclaration> = Vec::new();

          for decl in &style_rule.declarations.declarations {
            let prop_name = decl.property_id().name().to_string();
            let prop_value = format!("{:?}", decl);

            let property = CString::new(prop_name).unwrap_or_else(|_| CString::new("").unwrap());
            let value = CString::new(prop_value).unwrap_or_else(|_| CString::new("").unwrap());

            let css_decl = Box::new(CSSDeclaration {
              property: property.into_raw(),
              value: value.into_raw(),
            });

            decls_vec.push(Box::into_raw(css_decl));
          }

          let decl_count = decls_vec.len();

          let decls_ptr = if decl_count > 0 {
            let mut boxed = decls_vec.into_boxed_slice();
            let ptr = boxed.as_mut_ptr();
            std::mem::forget(boxed);
            ptr
          } else {
            ptr::null_mut()
          };

          let css_rule = Box::new(CSSRule {
            selector: selector.into_raw(),
            declarations: decls_ptr,
            declaration_count: decl_count,
          });

          rules_vec.push(Box::into_raw(css_rule));
        }
      }

      let rule_count = rules_vec.len();
      let rules_ptr = if rule_count > 0 {
        let mut boxed = rules_vec.into_boxed_slice();
        let ptr = boxed.as_mut_ptr();
        std::mem::forget(boxed);
        ptr
      } else {
        ptr::null_mut()
      };

      CSSParseResult {
        success: true,
        error_message: ptr::null_mut(),
        rules: rules_ptr,
        rule_count,
      }
    }
    Err(e) => create_error_result(&format!("CSS parse error: {:?}", e)),
  }
}

fn create_error_result(error: &str) -> CSSParseResult {
  let error_message = CString::new(error).unwrap_or_else(|_| CString::new("Unknown error").unwrap());

  CSSParseResult {
    success: false,
    error_message: error_message.into_raw(),
    rules: ptr::null_mut(),
    rule_count: 0,
  }
}

fn create_error_result_ptr(error: &str) -> *mut CSSParseResult {
  let result = Box::new(create_error_result(error));
  Box::into_raw(result)
}
