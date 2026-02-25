use herb_config::LinterConfig;
use herb_linter::linter::Linter;
use herb_linter::rule::LintContext;

fn lint(source: &str) -> herb_linter::offense::LintResult {
  let linter = Linter::default();
  let context = LintContext::default();
  linter.lint(source, &context)
}

fn lint_with_file(source: &str, file_name: &str) -> herb_linter::offense::LintResult {
  let linter = Linter::default();
  let context = LintContext {
    file_name: Some(file_name.to_string()),
  };
  linter.lint(source, &context)
}

// ── parser-no-errors ──────────────────────────────────────────────────

#[test]
fn test_parser_no_errors_clean() {
  let result = lint("<div>hello</div>");
  assert_eq!(result.errors, 0);
  assert!(result.offenses.is_empty());
}

#[test]
fn test_parser_no_errors_with_error() {
  let result = lint("<div>");
  assert!(result.errors > 0);
  assert!(result
    .offenses
    .iter()
    .any(|offense| offense.rule == "parser-no-errors"));
}

// ── html-img-require-alt ──────────────────────────────────────────────

#[test]
fn test_img_require_alt_missing() {
  let result = lint("<img src=\"photo.jpg\">");
  assert_eq!(result.offenses.len(), 1);
  assert_eq!(result.offenses[0].rule, "html-img-require-alt");
  assert!(result.offenses[0].message.contains("alt"));
}

#[test]
fn test_img_require_alt_present() {
  let result = lint("<img src=\"photo.jpg\" alt=\"A photo\">");
  let alt_offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-img-require-alt")
    .collect();
  assert!(alt_offenses.is_empty());
}

#[test]
fn test_img_require_alt_empty_alt() {
  let result = lint("<img src=\"photo.jpg\" alt=\"\">");
  let alt_offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-img-require-alt")
    .collect();
  assert!(alt_offenses.is_empty());
}

// ── html-tag-name-lowercase ───────────────────────────────────────────

#[test]
fn test_tag_name_lowercase_uppercase() {
  let result = lint("<DIV>hello</DIV>");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-tag-name-lowercase")
    .collect();
  assert_eq!(offenses.len(), 2); // open + close
  assert!(offenses[0].message.contains("lowercase"));
}

#[test]
fn test_tag_name_lowercase_already_lowercase() {
  let result = lint("<div>hello</div>");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-tag-name-lowercase")
    .collect();
  assert!(offenses.is_empty());
}

#[test]
fn test_tag_name_lowercase_mixed_case() {
  let result = lint("<Div>hello</Div>");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-tag-name-lowercase")
    .collect();
  assert_eq!(offenses.len(), 2);
}

// ── html-no-self-closing ──────────────────────────────────────────────

#[test]
fn test_no_self_closing_br() {
  let result = lint("<br />");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-no-self-closing")
    .collect();
  assert_eq!(offenses.len(), 1);
  assert!(offenses[0].message.contains("<br>"));
}

#[test]
fn test_no_self_closing_div() {
  let result = lint("<div />");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-no-self-closing")
    .collect();
  assert_eq!(offenses.len(), 1);
  assert!(offenses[0].message.contains("<div></div>"));
}

#[test]
fn test_no_self_closing_void_ok() {
  let result = lint("<br>");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-no-self-closing")
    .collect();
  assert!(offenses.is_empty());
}

#[test]
fn test_no_self_closing_img_with_alt() {
  let result = lint("<img src=\"photo.jpg\" alt=\"photo\" />");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-no-self-closing")
    .collect();
  assert_eq!(offenses.len(), 1);
  assert!(offenses[0].message.contains("<img>"));
}

// ── erb-require-trailing-newline ──────────────────────────────────────

#[test]
fn test_trailing_newline_missing() {
  let result = lint_with_file("<div>hello</div>", "test.html.erb");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "erb-require-trailing-newline")
    .collect();
  assert_eq!(offenses.len(), 1);
  assert!(offenses[0].message.contains("trailing newline"));
}

#[test]
fn test_trailing_newline_present() {
  let result = lint_with_file("<div>hello</div>\n", "test.html.erb");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "erb-require-trailing-newline")
    .collect();
  assert!(offenses.is_empty());
}

#[test]
fn test_trailing_newline_too_many() {
  let result = lint_with_file("<div>hello</div>\n\n", "test.html.erb");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "erb-require-trailing-newline")
    .collect();
  assert_eq!(offenses.len(), 1);
  assert!(offenses[0].message.contains("exactly one"));
}

#[test]
fn test_trailing_newline_no_file_name() {
  // Without file_name, the rule should not fire (snippet mode)
  let result = lint("<div>hello</div>");
  let offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "erb-require-trailing-newline")
    .collect();
  assert!(offenses.is_empty());
}

// ── Linter integration ───────────────────────────────────────────────

#[test]
fn test_linter_rule_count() {
  let linter = Linter::default();
  assert_eq!(linter.rule_count(), 5);
}

#[test]
fn test_linter_rule_names() {
  let linter = Linter::default();
  let names = linter.rule_names();
  assert!(names.contains(&"parser-no-errors"));
  assert!(names.contains(&"html-img-require-alt"));
  assert!(names.contains(&"html-tag-name-lowercase"));
  assert!(names.contains(&"html-no-self-closing"));
  assert!(names.contains(&"erb-require-trailing-newline"));
}

#[test]
fn test_linter_config_disable_rule() {
  let mut config = LinterConfig::new();
  config.rules.insert(
    "html-img-require-alt".to_string(),
    herb_config::RuleConfig {
      enabled: false,
      ..Default::default()
    },
  );

  let linter = Linter::new(config);
  let context = LintContext::default();
  let result = linter.lint("<img src=\"photo.jpg\">", &context);

  let alt_offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-img-require-alt")
    .collect();
  assert!(alt_offenses.is_empty());
}

#[test]
fn test_linter_config_severity_override() {
  let mut config = LinterConfig::new();
  config.rules.insert(
    "html-img-require-alt".to_string(),
    herb_config::RuleConfig {
      enabled: true,
      severity: Some(herb_config::Severity::Warning),
      ..Default::default()
    },
  );

  let linter = Linter::new(config);
  let context = LintContext::default();
  let result = linter.lint("<img src=\"photo.jpg\">", &context);

  let alt_offenses: Vec<_> = result
    .offenses
    .iter()
    .filter(|offense| offense.rule == "html-img-require-alt")
    .collect();
  assert_eq!(alt_offenses.len(), 1);
  assert_eq!(alt_offenses[0].severity, herb_config::Severity::Warning);
}

#[test]
fn test_empty_source() {
  let result = lint("");
  assert!(result.offenses.is_empty());
}

#[test]
fn test_multiple_issues() {
  let result = lint("<IMG src=\"photo.jpg\"><BR />");
  // Should have: uppercase IMG, missing alt, uppercase BR, self-closing BR
  assert!(result.offenses.len() >= 3);
}
