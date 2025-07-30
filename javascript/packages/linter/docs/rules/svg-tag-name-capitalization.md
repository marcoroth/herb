# Linter Rule: SVG tag name capitalization

**Rule:** `svg-tag-name-capitalization`

## Description

Enforces proper camelCase capitalization for SVG element names within SVG contexts.

## Rationale

SVG elements use camelCase naming conventions (e.g., `linearGradient`, `clipPath`, `feGaussianBlur`) rather than the lowercase conventions used in HTML. This rule ensures that SVG elements within `<svg>` tags use the correct capitalization for proper rendering and standards compliance.

This rule only applies to elements within SVG contexts and does not check the `<svg>` tag itself (that's handled by the `html-tag-name-lowercase` rule).

## Examples

### ✅ Good

```html
<svg>
  <linearGradient id="grad1">
    <stop offset="0%" stop-color="rgb(255,255,0)" />
  </linearGradient>
</svg>
```

```html
<svg>
  <clipPath id="clip">
    <rect width="100" height="100" />
  </clipPath>
  <feGaussianBlur stdDeviation="5" />
</svg>
```

### 🚫 Bad

```html
<svg>
  <lineargradient id="grad1">
    <stop offset="0%" stop-color="rgb(255,255,0)" />
  </lineargradient>
</svg>
```

```html
<svg>
  <CLIPPATH id="clip">
    <rect width="100" height="100" />
  </CLIPPATH>
</svg>
```

## References

* [SVG Element Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Element)
* [SVG Naming Conventions](https://www.w3.org/TR/SVG2/)
