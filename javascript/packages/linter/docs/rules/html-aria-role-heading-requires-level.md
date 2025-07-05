# Linter Rule: ARIA role with heading requires level

**Rule:** `html-aria-role-heading-requires-level`

## Description

Ensure that any element with `role="heading"` also has a valid `aria-level` attribute. The `aria-level` defines the heading level (1–6) and is required for assistive technologies to properly interpret the document structure.

## Rationale

In HTML, semantic heading elements like `<h1>` through `<h6>` implicitly define their level. When using `role="heading"` on non-semantic elements (e.g., `<div>`, `<span>`), the level must be explicitly declared using `aria-level`, otherwise screen readers and accessibility tools may not understand the document hierarchy.

## Examples

### ✅ Good

```html
<div role="heading" aria-level="2">Section Title</div>

<span role="heading" aria-level="1">Main Title</span>
```

### 🚫 Bad

```html
<div role="heading">Section Title</div>

<span role="heading">Main Title</span>
```

## References

* [ARIA: `heading` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/heading_role)
* [ARIA: `aria-level` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-level)
