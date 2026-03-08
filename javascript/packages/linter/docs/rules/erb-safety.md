# Linter Rule: Disallow unsafe ERB output in HTML attribute positions and attribute names

**Rule:** `erb-safety`

## Description

Disallow the use of ERB output tags (`<%= %>` or `<%== %>`) in HTML attribute positions or inside HTML attribute names. These patterns can lead to cross-site scripting (XSS) vulnerabilities by allowing dynamic injection of arbitrary HTML attributes.

## Rationale

ERB output tags in attribute positions (e.g., `<div <%= attributes %>>`) allow arbitrary attribute injection at runtime, which is a security risk. An attacker could inject event handler attributes like `onmouseover` or `onfocus` to execute JavaScript.

Similarly, ERB output in attribute names (e.g., `<div data-<%= key %>="value">`) allows dynamic control over which attributes are rendered, which can also be exploited for attribute injection attacks.

Use ERB control flow (`<% %>`) with static attribute names instead, or place dynamic values only in attribute values where they are properly escaped by the template engine.

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

### ✅ Good

```erb
<div class="<%= css_class %>"></div>
```

```erb
<input value="<%= user.name %>">
```

```erb
<a href="<%= path %>">Link</a>
```

```erb
<div <% if active? %> class="active" <% end %>></div>
```

```erb
<input <% unless disabled? %> enabled <% end %>>
```

### 🚫 Bad

```erb
<div <%= data_attributes %>></div>
```

```erb
<div <%== raw_attributes %>></div>
```

```erb
<div <%= first_attrs %> <%= second_attrs %>></div>
```

```erb
<div data-<%= key %>="value"></div>
```

```erb
<div data-<%= key1 %>="value1" data-<%= key2 %>="value2"></div>
```

## References

- [Shopify/erb_lint: ErbSafety](https://github.com/Shopify/erb_lint/tree/main?tab=readme-ov-file#erbsafety)
- [Shopify/better_html](https://github.com/Shopify/better_html)
