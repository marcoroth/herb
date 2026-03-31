# Linter Rule: Disallow inline script elements

**Rule:** `html-no-script-elements`

## Description

Disallow the use of inline `<script>` tags in HTML templates.

## Rationale

Inline JavaScript poses a significant security risk and is incompatible with strict Content Security Policy (CSP) configurations (`script-src 'self'`).

All JavaScript should be included via external assets to support strong CSP policies that prevent cross-site scripting (XSS) attacks.

This rule enforces:

- No `<script>` tags embedded directly in templates.

## Examples

### ✅ Good

```erb
<%= javascript_include_tag "application" %>
```

```erb
<script type="application/json">
  {"key": "value"}
</script>
```

```erb
<script type="application/ld+json">
  {"@context": "https://schema.org"}
</script>
```

### 🚫 Bad

```erb
<script>
  alert("Hello, world!")
</script>
```

```erb
<script type="text/javascript">
  console.log("Hello")
</script>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
