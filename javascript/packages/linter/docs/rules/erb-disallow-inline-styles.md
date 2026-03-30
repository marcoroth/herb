# Linter Rule: Disallow inline `<style>` tags and `style` attributes

**Rule:** `erb-disallow-inline-styles`

## Description

Disallow the use of inline `<style>` tags and `style` attributes in HTML templates. All styling should be applied via external stylesheets or class-based styling.

## Rationale

Inline CSS makes templates harder to maintain, promotes duplication, and prevents adoption of strict CSP policies (`style-src 'self'`). Centralizing styles via external stylesheets improves maintainability and security.

This rule enforces:

- No `<style>` tags embedded directly in templates.
- No `style` tags generated via `content_tag` or `tag` helpers.
- No inline `style` attributes on HTML elements.

## Examples

### ✅ Good

```erb
<head>
  <%= stylesheet_link_tag "application" %>
</head>
```

```erb
<button class="btn btn-primary">Submit</button>
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

```erb
<button style="color: red;">Submit</button>
```

```erb
<div style="<%= custom_styles %>">Content</div>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
