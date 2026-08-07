# Linter Rule: Disallow inline `style` attributes

**Rule:** `html-no-style-attributes`

## Description

Disallow the use of inline `style` attributes on HTML elements. All styling should be applied via external stylesheets or class-based styling.

## Rationale

Inline `style` attributes make templates harder to maintain, promote duplication, and prevent adoption of strict CSP policies (`style-src 'self'`). Using CSS classes and external stylesheets improves maintainability and security.

## Examples

### ✅ Good

```erb
<button class="btn btn-primary">Submit</button>
```

```erb
<div data-controller="hello" data-action="click->hello#greet">Content</div>
```

### 🚫 Bad

```erb
<button style="color: red;">Submit</button>
```

```erb
<div style="<%= custom_styles %>">Content</div>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
