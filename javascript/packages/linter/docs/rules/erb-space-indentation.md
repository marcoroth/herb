# Linter Rule: Space Indentation

**Rule:** `erb-space-indentation`

## Description

Detects indentation with tabs. Consistent use of spaces for indentation improves readability and avoids alignment issues across editors and tools.

## Examples

### ✅ Good

```erb
<div>
  <p>Hello</p>
</div>
```

### ❌ Bad

```erb
<div>
	<p>Hello</p>
</div>
```

## References

- [Shopify/erb_lint - `SpaceIndentation`](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/space_indentation.rb)
