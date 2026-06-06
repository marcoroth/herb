# Linter Rule: SVG must have accessible text

**Rule:** `a11y-svg-has-accessible-text`

## Description

Enforce that `<svg>` elements have accessible text via `aria-label`, `aria-labelledby`, or a nested `<title>` element. Decorative SVGs should be hidden with `aria-hidden="true"`.

## Rationale

SVG images without accessible text are invisible to screen readers and other assistive technologies. Every meaningful SVG should have a text alternative so that non-sighted users understand its purpose. Decorative SVGs that convey no meaning should be explicitly hidden with `aria-hidden="true"` to avoid confusing assistive technology users.

## Examples

### ✅ Good

```erb
<svg aria-label="Company logo">
  <path d="..." />
</svg>
```

```erb
<svg aria-labelledby="chart-title">
  <title id="chart-title">Monthly sales chart</title>
  <path d="..." />
</svg>
```

```erb
<svg>
  <title>Search icon</title>
  <path d="..." />
</svg>
```

```erb
<svg aria-hidden="true">
  <path d="..." />
</svg>
```

### 🚫 Bad

```erb
<svg>
  <path d="..." />
</svg>
```

```erb
<svg class="icon">
  <use href="#icon-search" />
</svg>
```

## References

- [WAI: SVG Accessibility](https://www.w3.org/wiki/SVG_Accessibility)
- [Deque: svg-img-alt](https://dequeuniversity.com/rules/axe/4.10/svg-img-alt)
