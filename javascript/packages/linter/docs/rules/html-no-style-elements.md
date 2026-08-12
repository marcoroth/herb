# Linter Rule: Disallow inline `<style>` tags

**Rule:** `html-no-style-elements`

## Description

Disallow the use of inline `<style>` tags in HTML templates. All styling should be applied via external stylesheets.

## Rationale

Inline `<style>` tags make templates harder to maintain, promote duplication, and prevent adoption of strict CSP policies (`style-src 'self'`). Centralizing styles via external stylesheets improves maintainability and security.

This rule enforces:

- No `<style>` tags embedded directly in templates.
- No `style` tags generated via `content_tag` or `tag` helpers.

## Examples

### ✅ Good

```erb
<head>
  <%= stylesheet_link_tag "application" %>
</head>
```

### 🚫 Bad

```erb
<head>
  <style>
    .danger { color: red; }
  </style>
</head>
```

```erb
<%= content_tag :style do %>
  .danger { color: red; }
<% end %>
```

```erb
<%= tag.style do %>
  .danger { color: red; }
<% end %>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
