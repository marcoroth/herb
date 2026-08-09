# Linter Rule: Indentation

**Rule:** `source-indentation`

## Description

Detects indentation that doesn't match the configured indentation style. By default, spaces are expected and tabs are flagged. Consistent use of a single indentation character improves readability and avoids alignment issues across editors and tools.

## Configuration

Set `formatter.indentStyle` in your Herb config to `"spaces"` (default) or `"tabs"` to control which character this rule expects and which one `--fix` writes. The same option also controls the indentation the [formatter](/projects/formatter) writes.

```yaml
formatter:
  indentStyle: tabs
```

## Rationale

Mixing tabs and spaces for indentation causes inconsistent visual formatting across different editors, tools, and environments. Tabs render at different widths depending on the viewer's settings, which can make code appear misaligned or harder to read. Standardizing on a single indentation character ensures that code appears the same regardless of editor or tool, diffs and code reviews display consistently, and the codebase maintains a uniform visual style.

## Examples

### ✅ Good (default: spaces)

```erb
<div>
  <p>Hello</p>
</div>
```

### 🚫 Bad (default: spaces)

```erb
<div>
	<p>Hello</p>
</div>
```

### ✅ Good (`indentStyle: tabs`)

```erb
<div>
	<p>Hello</p>
</div>
```

### 🚫 Bad (`indentStyle: tabs`)

```erb
<div>
  <p>Hello</p>
</div>
```

## References

- [Shopify/erb_lint - `SpaceIndentation`](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/space_indentation.rb)
