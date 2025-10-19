# Linter Rule: Enforce trailing newline

**Rule:** `erb-require-trailing-newline`

## Description

This rule enforces that all HTML+ERB template files end with exactly one trailing newline character. This is a formatting convention widely adopted across many languages and tools.

## Rationale

Ensuring HTML+ERB files end with a single trailing newline aligns with POSIX conventions, where text files should end with a newline character.

This practice avoids unnecessary diffs from editors or formatters that auto-insert final newlines, improving compatibility with command-line tools and version control systems. It also helps maintain a clean, predictable structure across view files.

Trailing newlines are a common convention in Ruby and are enforced by tools like RuboCop and many Git-based workflows.

## Examples

### ✅ Good

```
<%= render partial: "header" %>
<%= render partial: "footer" %>
```

### 🚫 Bad

```erb
<%= render partial: "header" %>
<%= render partial: "footer" %>▌
```

## References

- [POSIX: Text files and trailing newlines](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_206)
- [Git: Trailing newlines and diffs](https://git-scm.com/docs/git-diff#_generating_patches_with_p)
- [EditorConfig: `insert_final_newline`](https://github.com/editorconfig/editorconfig/wiki/EditorConfig-Properties#insert_final_newline)
