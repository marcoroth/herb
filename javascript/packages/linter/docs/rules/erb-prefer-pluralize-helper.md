# Linter Rule: Prefer the `pluralize` helper over `String#pluralize` for counts

**Rule:** `erb-prefer-pluralize-helper`

## Description

Prefer Rails' `ActionView::Helpers::TextHelper#pluralize` helper over calling `String#pluralize` with a count in ERB templates.

## Rationale

Both `pluralize("Alias", count)` and `"Alias".pluralize(count)` inflect a word based on a count, but they behave differently. The `pluralize` helper prepends the count to the resulting string (e.g. `pluralize(2, "person")` returns `"2 people"`), which is almost always what you want when rendering a count next to a noun. It also handles the `1`/singular case correctly and reads naturally in a template.

Reaching for `String#pluralize(count)` usually means the count is rendered separately, leading to duplicated output like `<%= aliases.size %> <%= "Alias".pluralize(aliases.size) %>`. Consolidating on the `pluralize` helper keeps the count and the noun together, avoids the extra output tag, and makes the intent clearer.

## Examples

### ✅ Good

```erb
<%= pluralize("Known Alias", aliases.size) %>
```

```erb
Known <%= pluralize("Alias", aliases.size) %>
```

### 🚫 Bad

```erb
<%= aliases.size %><%= "Known Alias".pluralize(aliases.size) %>
```

```erb
<%= aliases.size %> Known <%= "Alias".pluralize(aliases.size) %>
```

## References

- [`ActionView::Helpers::TextHelper#pluralize`](https://api.rubyonrails.org/classes/ActionView/Helpers/TextHelper.html#method-i-pluralize)
- [`String#pluralize`](https://api.rubyonrails.org/classes/String.html#method-i-pluralize)
