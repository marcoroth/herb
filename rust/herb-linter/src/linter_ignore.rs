const HERB_LINTER_PREFIX: &str = "herb:linter";

pub fn herb_linter_ignore_prefix() -> String {
  format!("{HERB_LINTER_PREFIX} ignore")
}

/// Whether an ERB comment is a `herb:linter ignore` directive.
pub fn is_herb_linter_ignore_comment(content: &str) -> bool {
  content.trim() == herb_linter_ignore_prefix()
}

/// Whether the document carries a `herb:linter ignore` directive anywhere.
pub fn has_linter_ignore_directive(source: &str) -> bool {
  let prefix = herb_linter_ignore_prefix();

  for line in source.lines() {
    let trimmed = line.trim();

    if !trimmed.contains(&prefix) {
      continue;
    }

    if let Some(start) = trimmed.find("<%#") {
      if let Some(end) = trimmed[start..].find("%>") {
        if is_herb_linter_ignore_comment(&trimmed[start + 3..start + end]) {
          return true;
        }
      }
    }
  }

  false
}
