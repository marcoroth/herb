# Linter Rule: Indentation

**Rule:** `source-indentation`

## Description

Detects indentation with tabs. Consistent use of spaces for indentation improves readability and avoids alignment issues across editors and tools.

## Rationale

Mixing tabs and spaces for indentation causes inconsistent visual formatting across different editors, tools, and environments. Tabs render at different widths depending on the viewer's settings, which can make code appear misaligned or harder to read. Standardizing on space indentation ensures that code appears the same regardless of editor or tool, diffs and code reviews display consistently, and the codebase maintains a uniform visual style.

## Examples

### ✅ Good

```erb
<div>
  <p>Hello</p>
</div>
```

### 🚫 Bad

```erb
<div>
	<p>Hello</p>
</div>
```

## References

- [Shopify/erb_lint - `SpaceIndentation`](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/space_indentation.rb)
