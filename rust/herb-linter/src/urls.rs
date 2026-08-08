use std::sync::LazyLock;

pub const DOCS_BASE_URL: &str = "https://herb-tools.dev";

pub static DOCS_LINTER_BASE_URL: LazyLock<String> = LazyLock::new(|| format!("{DOCS_BASE_URL}/linter/rules"));

pub static RULE_CONFIGURATION_DOCUMENTATION_URL: LazyLock<String> =
  LazyLock::new(|| format!("{DOCS_BASE_URL}/configuration#setting-the-default-for-all-rules"));

pub fn rule_documentation_url(rule_id: &str) -> String {
  format!("{}/{rule_id}", *DOCS_LINTER_BASE_URL)
}
