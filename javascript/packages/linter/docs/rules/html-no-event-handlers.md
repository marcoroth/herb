# Linter Rule: Disallow inline event handler attributes

**Rule:** `html-no-event-handlers`

## Description

Disallow the use of inline JavaScript event handler attributes (e.g. `onclick`, `onload`) in HTML templates.

## Rationale

Inline JavaScript poses a significant security risk and is incompatible with strict Content Security Policy (CSP) configurations (`script-src 'self'`).

All JavaScript should be included via external assets to support strong CSP policies that prevent cross-site scripting (XSS) attacks.

This rule enforces:

- No event handler attributes (`onclick`, `onmouseover`, etc.) on HTML elements.
- No event handler attributes on ActionView tag helpers (e.g. `<%= tag.button onclick: "..." %>`).

## Examples

### ✅ Good

```erb
<button type="submit" class="btn">Submit</button>
```

```erb
<div data-controller="hello" data-action="click->hello#greet">
  Content
</div>
```

```erb
<%= tag.button "Submit", class: "btn" %>
```

### 🚫 Bad

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

```erb
<%= tag.button "Submit", onclick: "doSomething()" %>
```

## References

- Inspired by [@pushcx](https://bsky.app/profile/push.cx/post/3lsfddauapk2o)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [wooorm/html-event-attributes](https://github.com/wooorm/html-event-attributes)
