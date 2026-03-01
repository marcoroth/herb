# Linter Rule: Require `href` attribute on `<a>` tags

**Rule:** `html-anchor-require-href`

## Description

An `<a>` element that has an `href` attribute represents a hyperlink (a hypertext anchor) labeled by its contents. Links should go somewhere. If you want to perform an action without navigating the user to a new URL, use a `<button>` instead.

## Rationale

Anchor tags without an `href` attribute are not focusable via keyboard navigation and are not visible to screen readers. This makes them inaccessible to users who rely on assistive technologies.

## Examples

### ✅ Good

```erb
<a href="https://alink.com">I'm a real link</a>
```

### 🚫 Bad

```erb
<a>Go to Page</a>
```

```erb
<a data-action="click->doSomething">I'm a fake link</a>
```

## References

* [MDN: The Anchor element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)
* [HTML Spec: The `a` element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
* [WAI-ARIA 1.2: `link` role](https://www.w3.org/TR/wai-aria-1.2/#link)
* [Primer: Links](https://primer.style/design/accessibility/links)
* [Links vs. Buttons in Modern Web Applications](https://marcysutton.com/links-vs-buttons-in-modern-web-applications)
* [Button vs. Link](https://a11y-101.com/design/button-vs-link)
* [MDN: ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role)
* [Disabled Links](https://www.scottohara.me/blog/2021/05/28/disabled-links.html)
* [`erblint-github`: `LinkHasHref`](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/link-has-href.md)
