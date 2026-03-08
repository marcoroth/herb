# Linter Rule: Disallow ERB output in attribute names

**Rule:** `erb-no-output-in-attribute-name`

## Description

ERB output tags (`<%= %>`) are not allowed in HTML attribute names. Use static attribute names with dynamic values instead.

## Rationale

ERB output in attribute names (e.g., `<div data-<%= key %>="value">`) allows dynamic control over which attributes are rendered. When such a value is user-controlled, an attacker can inject arbitrary attributes including JavaScript event handlers, achieving cross-site scripting (XSS).

## Examples

### Good

```erb
<div class="<%= css_class %>"></div>
```

```erb
<input type="text" data-target="value">
```

### Bad

```erb
<div data-<%= key %>="value"></div>
```

```erb
<div data-<%= key1 %>="value1" data-<%= key2 %>="value2"></div>
```

## References

- [Shopify/erb_lint: `ErbSafety`](https://github.com/Shopify/erb_lint/tree/main?tab=readme-ov-file#erbsafety)
- [Shopify/better_html](https://github.com/Shopify/better_html)
