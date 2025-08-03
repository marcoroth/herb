# Linter Rule: `aria-level` must be between 1 and 6

**Rule:** `html-aria-level-must-be-valid`

## Description

Ensure that the value of the `aria-level` attribute is a valid heading level: an integer between `1` and `6`. This attribute is used with `role="heading"` to indicate a heading level for non-semantic elements like `<div>` or `<span>`.

## Rationale

The WAI-ARIA specification defines `aria-level` as an integer between `1` (highest/most important) and `6` (lowest/subheading). Any other value is invalid and may confuse screen readers or fail accessibility audits.

## Examples

### ✅ Good

```erb
<div role="heading" aria-level="1">Main</div>
<div role="heading" aria-level="6">Footnote</div>
```

### 🚫 Bad

```erb
<div role="heading" aria-level="-1">Negative</div>

<div role="heading" aria-level="0">Main</div>

<div role="heading" aria-level="7">Too deep</div>

<div role="heading" aria-level="foo">Invalid</div>
```

## References

- [ARIA: `heading` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/heading_role)
- [ARIA: `aria-level` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-level)
