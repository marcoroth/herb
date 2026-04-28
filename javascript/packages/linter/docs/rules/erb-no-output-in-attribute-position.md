# Linter Rule: Disallow ERB output in attribute position

**Rule:** `erb-no-output-in-attribute-position`

## Description

ERB output tags (`<%= %>` or `<%== %>`) are not allowed in attribute position. Use ERB control flow (`<% %>`) with static attribute names instead.

## Rationale

ERB output tags in attribute positions (e.g., `<div <%= attributes %>>`) allow arbitrary attribute injection at runtime. An attacker could inject event handler attributes like `onmouseover` or `onfocus` to execute JavaScript.

For example, a common pattern like:

```erb
<div <%= "hidden" if index != 0 %>>...</div>
```

should be rewritten to use control flow with static attributes:

```erb
<div <% if index != 0 %> hidden <% end %>>...</div>
```

This ensures attribute names are always statically defined and prevents arbitrary attribute injection.

## Examples

### Good

```erb
<div class="<%= css_class %>"></div>
```

```erb
<input value="<%= user.name %>">
```

```erb
<div <% if active? %> class="active" <% end %>></div>
```

### Bad

```erb
<div <%= data_attributes %>></div>
```

```erb
<div <%== raw_attributes %>></div>
```

```erb
<div <%= first_attrs %> <%= second_attrs %>></div>
```

## References

- [Shopify/erb_lint: `ErbSafety`](https://github.com/Shopify/erb_lint/tree/main?tab=readme-ov-file#erbsafety)
- [Shopify/better_html](https://github.com/Shopify/better_html)
