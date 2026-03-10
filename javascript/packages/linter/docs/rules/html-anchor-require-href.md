# Linter Rule: Require `href` attribute on `<a>` tags

**Rule:** `html-anchor-require-href`

## Description

Disallow the use of anchor tags without an `href` attribute in HTML templates. Use if you want to perform an action without having the user navigated to a new URL.

## Rationale

Anchor tags without href are unfocusable if user is using keyboard navigation, or is unseen by screen readers.

## Examples

### ✅ Good

```erb
<a href="https://alink.com">I'm a real link</a>
```

### 🚫 Bad

```erb
<a data-action="click->doSomething">I'm a fake link</a>
```

## References

* https://marcysutton.com/links-vs-buttons-in-modern-web-applications
* https://a11y-101.com/design/button-vs-link
* https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role
* https://www.scottohara.me/blog/2021/05/28/disabled-links.html#w3c/html-aria#305
