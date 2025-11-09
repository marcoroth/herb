# Linter Rule: `aria-label` must be well-formatted

**Rule:** `html-aria-label-is-well-formatted`

## Description

Ensure that the value of the `aria-label` attribute is formatted like natural, visual text. The text should use sentence case (capitalize the first letter), avoid line breaks, and not look like an ID or code identifier.

## Rationale

The `aria-label` attribute provides an accessible name for elements that will be read aloud by screen readers. The text should be formatted like natural language that users would expect to hear, not like technical identifiers. Using proper sentence case and avoiding formatting that looks like code (snake_case, kebab-case, camelCase) ensures a better user experience for assistive technology users.

## Examples

### ✅ Good

```erb
<button aria-label="Close dialog">X</button>
<input aria-label="Search products" type="search" autocomplete="off">
<button aria-label="Page 2 of 10">2</button>
```

### 🚫 Bad

```erb
<!-- Starts with lowercase -->
<button aria-label="close dialog">X</button>

<!-- Contains line breaks -->
<button aria-label="Close
dialog">X</button>

<!-- Looks like an ID (snake_case) -->
<button aria-label="close_dialog">X</button>

<!-- Looks like an ID (kebab-case) -->
<button aria-label="close-dialog">X</button>

<!-- Looks like an ID (camelCase) -->
<button aria-label="closeDialog">X</button>

<!-- HTML entity line breaks -->
<button aria-label="Close&#10;dialog">X</button>
```

## References

- [ARIA: `aria-label` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)
- [erblint-github: GitHub::Accessibility::AriaLabelIsWellFormatted](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/aria-label-is-well-formatted.md)
