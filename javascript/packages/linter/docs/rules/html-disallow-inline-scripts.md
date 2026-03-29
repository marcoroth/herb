# Linter Rule: Disallow inline script tags and event handler attributes

**Rule:** `html-disallow-inline-scripts`

## Description

Disallow the use of inline `<script>` tags and inline JavaScript event handler attributes (e.g. `onclick`, `onload`) in HTML templates.

## Rationale

Inline JavaScript poses a significant security risk and is incompatible with strict Content Security Policy (CSP) configurations (`script-src 'self'`).

All JavaScript should be included via external assets to support strong CSP policies that prevent cross-site scripting (XSS) attacks.

This rule enforces:

- No `<script>` tags embedded directly in templates.
- No event handler attributes (`onclick`, `onmouseover`, etc.).

## Examples

### ✅ Good

```erb
<%= javascript_include_tag "application" %>
```

```erb
<button type="submit" class="btn">Submit</button>
```

```erb
<div data-controller="hello" data-action="click->hello#greet">
  Content
</div>
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

```erb
<button onclick="doSomething()">Click</button>
```

```erb
<body onload="init()"></body>
```

```erb
<div onmouseover="highlight()">Hover me</div>
```

```erb
<form onsubmit="validate()"></form>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [wooorm/html-event-attributes](https://github.com/wooorm/html-event-attributes)
- [GeeksforGeeks: HTML Event Attributes](https://www.geeksforgeeks.org/html/html-event-attributes/)
