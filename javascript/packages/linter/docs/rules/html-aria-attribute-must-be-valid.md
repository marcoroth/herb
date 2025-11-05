# Linter Rule: Disallow invalid or unknown `aria-*` attributes.

**Rule:** `html-aria-attribute-must-be-valid`

## Description

Disallow unknown or invalid `aria-*` attributes. Only attributes defined in the WAI-ARIA specification should be used. This rule helps catch typos (e.g. `aria-lable`), misuse, or outdated attribute names that won't be interpreted by assistive technologies.

## Rationale

ARIA attributes are powerful accessibility tools, but **only if used correctly**. Mistyped or unsupported attributes:

- Are silently ignored by browsers and screen readers
- Fail to communicate intent
- Give a false sense of accessibility

Validating against a known list ensures you're using correct and effective ARIA patterns.

## Examples

### ✅ Good

```html
<div role="button" aria-pressed="false">Toggle</div>
<input type="text" aria-label="Search" autocomplete="off">
<span role="heading" aria-level="2">Title</span>
```

### 🚫 Bad

```html
<div role="button" aria-presed="false">Toggle</div>

<input type="text" aria-lable="Search" autocomplete="off">

<span aria-size="large" role="heading" aria-level="2">Title</span>
```

## References

- [ARIA states and properties (attributes)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes)
- [NPM Package: `aria-attributes`](https://github.com/wooorm/aria-attributes)
