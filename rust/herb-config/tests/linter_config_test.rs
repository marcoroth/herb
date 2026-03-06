use std::collections::HashMap;

use herb_config::{LinterConfig, RuleConfig, Severity};

#[test]
fn is_rule_enabled_returns_true_when_rule_is_enabled() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        enabled: true,
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled("html-tag-name-lowercase", true));
}

#[test]
fn is_rule_enabled_returns_false_when_rule_is_disabled() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        enabled: false,
        ..Default::default()
      },
    )]),
  };

  assert!(!config.is_rule_enabled("html-tag-name-lowercase", true));
}

#[test]
fn is_rule_enabled_returns_default_when_rule_is_not_configured() {
  let config = LinterConfig::new();

  assert!(config.is_rule_enabled("html-tag-name-lowercase", true));
  assert!(!config.is_rule_enabled("html-tag-name-lowercase", false));
}

#[test]
fn get_severity_returns_default_when_not_configured() {
  let config = LinterConfig::new();

  assert_eq!(config.get_severity("some-rule", Severity::Warning), Severity::Warning);
}

#[test]
fn get_severity_returns_configured_severity() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        severity: Some(Severity::Error),
        ..Default::default()
      },
    )]),
  };

  assert_eq!(config.get_severity("html-tag-name-lowercase", Severity::Warning), Severity::Error);
}

#[test]
fn get_severity_returns_default_when_severity_not_set_on_rule() {
  let config = LinterConfig {
    rules: HashMap::from([("html-tag-name-lowercase".into(), RuleConfig::default())]),
  };

  assert_eq!(config.get_severity("html-tag-name-lowercase", Severity::Warning), Severity::Warning);
}

#[test]
fn is_rule_enabled_for_path_returns_true_when_no_patterns() {
  let config = LinterConfig::new();

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_false_when_path_matches_rule_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        exclude: vec!["app/views/legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_true_when_path_does_not_match_rule_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        exclude: vec!["app/views/legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_true_when_path_matches_only() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        only: vec!["app/views/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_false_when_path_does_not_match_only() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        only: vec!["app/views/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "lib/templates/email.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_respects_both_only_and_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        only: vec!["app/views/**/*".into()],
        exclude: vec!["app/views/legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "lib/templates/email.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_true_when_path_matches_include() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        include: vec!["app/components/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_returns_false_when_path_does_not_match_include() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        include: vec!["app/components/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_respects_include_and_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        include: vec!["app/components/**/*".into()],
        exclude: vec!["app/components/legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/legacy/old.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_only_overrides_include() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        include: vec!["app/components/**/*".into()],
        only: vec!["app/views/**/*".into()],
        exclude: vec!["app/views/legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/home/index.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/components/button.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/legacy/old.html.erb", &[]));
}

#[test]
fn is_rule_enabled_for_path_respects_default_exclude() {
  let config = LinterConfig::new();

  assert!(!config.is_rule_enabled_for_path("some-rule", "vendor/bundle/file.html.erb", &["vendor/**/*"]));
  assert!(config.is_rule_enabled_for_path("some-rule", "app/views/index.html.erb", &["vendor/**/*"]));
}

#[test]
fn is_rule_enabled_for_path_rule_exclude_overrides_default_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        exclude: vec!["legacy/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "vendor/bundle/file.html.erb", &["vendor/**/*"]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/old.html.erb", &["vendor/**/*"]));
}

#[test]
fn is_rule_enabled_for_path_include_overrides_default_exclude() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        include: vec!["legacy/**/*".into(), "node_modules/**/*".into()],
        exclude: vec!["generated/**/*".into()],
        ..Default::default()
      },
    )]),
  };

  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "legacy/index.html.erb", &["legacy/**/*"]));
  assert!(config.is_rule_enabled_for_path("html-tag-name-lowercase", "node_modules/pkg/file.html.erb", &["node_modules/**/*"]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "generated/output.html.erb", &[]));
  assert!(!config.is_rule_enabled_for_path("html-tag-name-lowercase", "app/views/index.html.erb", &[]));
}

#[test]
fn get_rule_config_returns_none_when_not_configured() {
  let config = LinterConfig::new();

  assert!(config.get_rule_config("some-rule").is_none());
}

#[test]
fn get_rule_config_returns_config_when_configured() {
  let config = LinterConfig {
    rules: HashMap::from([(
      "html-tag-name-lowercase".into(),
      RuleConfig {
        enabled: false,
        severity: Some(Severity::Error),
        ..Default::default()
      },
    )]),
  };

  let rule_config = config.get_rule_config("html-tag-name-lowercase").unwrap();
  assert!(!rule_config.enabled);
  assert_eq!(rule_config.severity, Some(Severity::Error));
}
