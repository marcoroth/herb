# Linter Rule: Prefer the `pluralize` helper over a separate count and `String#pluralize`

**Rule:** `actionview-prefer-pluralize-helper`

## Description

Disallow rendering a count in one ERB output tag and the noun it belongs to, pluralized with `String#pluralize`, in the next. The `ActionView::Helpers::TextHelper#pluralize` helper renders both from a single tag.

```
Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.
```

## Rationale

The two `pluralize` methods do different jobs. The helper takes the count first and renders it in front of the word, so `pluralize(2, "Known Alias")` returns `"2 Known Aliases"`. `String#pluralize` only inflects the word, so `"Known Alias".pluralize(2)` returns `"Known Aliases"` and the count has to go in an output tag of its own.

Writing both tags side by side splits one phrase across two tags and evaluates the count twice. The helper does the whole job once, and the singular and plural forms stay in one place where a translator or a reviewer can see them together.

A `String#pluralize` call on its own is not reported. Rendering the word without its count is exactly what that method is for, and a column header like `<%= "Known Alias".pluralize(aliases.size) %>` is correct as written.

The two counts have to be syntactically identical for the pair to be reported, so `<%= aliases.count %>` next to `"Alias".pluralize(aliases.size)` is left alone. A pair separated by an HTML element or by another ERB tag is left alone too, since the two tags cannot be collapsed into one without moving the markup between them.

A `String#pluralize` call that passes a locale is not reported, because the helper takes a plural form rather than a locale in that position.

## Examples

### ✅ Good

```erb
<%= pluralize(aliases.size, "Known Alias") %>
```

```erb
<%= "Known Alias".pluralize(aliases.size) %>
```

```erb
<%= aliases.count %> <%= "Known Alias".pluralize(aliases.size) %>
```

### 🚫 Bad

```erb
<%= aliases.size %><%= "Known Alias".pluralize(aliases.size) %>
```

```erb
<%= aliases.size %> <%= "Known Alias".pluralize(aliases.size) %>
```

```erb
<%= aliases.size %> Known <%= "Alias".pluralize(aliases.size) %>
```

## References

- [`ActionView::Helpers::TextHelper#pluralize`](https://api.rubyonrails.org/classes/ActionView/Helpers/TextHelper.html#method-i-pluralize)
- [`String#pluralize`](https://api.rubyonrails.org/classes/String.html#method-i-pluralize)
