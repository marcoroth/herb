# Linter Rule: Disallow commented-out ERB output tags

**Rule:** `erb-no-commented-out-output-tags`

## Description

Flag ERB comments that look like a temporarily commented-out output tag, i.e. `<%#=`, `<%# =`, `<%#==`, and `<%# ==`.

## Rationale

Commenting out an ERB output tag by inserting a `#` (which is what most editors do when you toggle a comment on `<%= ... %>`) is a convenient way to disable a tag while debugging, but it is easy to forget and commit. This rule surfaces those leftovers so they can either be removed or restored.

The rule intentionally only recognizes the `=` forms. A comment like `<%# hello world %>` is prose and is never flagged, and neither is a divider such as `<%# === Section === %>`.

This rule is reported at `info` severity and does not fail `herb lint` unless you raise `failLevel`.

## Examples

### ✅ Good

```erb
<%# This is a regular comment %>

<%# === Section divider === %>

<%= link_to "Home", root_path %>
```

### 🚫 Bad

```erb
<%#= link_to "Home", root_path %>

<%# = link_to "Home", root_path %>

<%#== raw_content %>
```

## References

\-
