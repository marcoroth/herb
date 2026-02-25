use std::ffi::CString;

#[test]
fn test_ffi_herb_lint() {
  let source = CString::new("<img src=\"photo.jpg\">").unwrap();

  unsafe {
    let result = herb_linter::ffi::herb_lint(source.as_ptr(), std::ptr::null(), std::ptr::null());
    assert!(!result.is_null());

    let lint_result = &*result;
    assert!(lint_result.offense_count > 0);
    assert!(lint_result.error_count > 0);
    assert!(!lint_result.json.is_null());

    let json_string = std::ffi::CStr::from_ptr(lint_result.json).to_str().unwrap();
    let parsed: serde_json::Value = serde_json::from_str(json_string).unwrap();
    assert!(parsed["offenses"].is_array());

    herb_linter::ffi::herb_lint_result_free(result);
  }
}

#[test]
fn test_ffi_herb_lint_clean() {
  let source = CString::new("<div>hello</div>").unwrap();

  unsafe {
    let result = herb_linter::ffi::herb_lint(source.as_ptr(), std::ptr::null(), std::ptr::null());
    assert!(!result.is_null());

    let lint_result = &*result;
    assert_eq!(lint_result.offense_count, 0);
    assert_eq!(lint_result.error_count, 0);

    herb_linter::ffi::herb_lint_result_free(result);
  }
}

#[test]
fn test_ffi_herb_lint_null_source() {
  unsafe {
    let result = herb_linter::ffi::herb_lint(std::ptr::null(), std::ptr::null(), std::ptr::null());
    assert!(result.is_null());
  }
}

#[test]
fn test_ffi_herb_lint_with_config() {
  let source = CString::new("<img src=\"photo.jpg\">").unwrap();
  let config = CString::new(r#"{"rules":{"html-img-require-alt":{"enabled":false}}}"#).unwrap();

  unsafe {
    let result = herb_linter::ffi::herb_lint(source.as_ptr(), config.as_ptr(), std::ptr::null());
    assert!(!result.is_null());

    let lint_result = &*result;
    // img-require-alt should be disabled
    let json_string = std::ffi::CStr::from_ptr(lint_result.json).to_str().unwrap();
    let parsed: serde_json::Value = serde_json::from_str(json_string).unwrap();
    let offenses = parsed["offenses"].as_array().unwrap();
    assert!(!offenses
      .iter()
      .any(|offense| offense["rule"] == "html-img-require-alt"));

    herb_linter::ffi::herb_lint_result_free(result);
  }
}

#[test]
fn test_ffi_rule_count() {
  let count = herb_linter::ffi::herb_lint_rule_count();
  assert_eq!(count, 5);
}

#[test]
fn test_ffi_rule_names() {
  unsafe {
    let mut count: usize = 0;
    let names = herb_linter::ffi::herb_lint_rule_names(&mut count);
    assert_eq!(count, 5);
    assert!(!names.is_null());

    let name_strings: Vec<String> = (0..count)
      .map(|index| {
        std::ffi::CStr::from_ptr(*names.add(index))
          .to_str()
          .unwrap()
          .to_string()
      })
      .collect();

    assert!(name_strings.contains(&"parser-no-errors".to_string()));
    assert!(name_strings.contains(&"html-img-require-alt".to_string()));
    assert!(name_strings.contains(&"html-tag-name-lowercase".to_string()));
    assert!(name_strings.contains(&"html-no-self-closing".to_string()));
    assert!(name_strings.contains(&"erb-require-trailing-newline".to_string()));

    herb_linter::ffi::herb_lint_rule_names_free(names, count);
  }
}
