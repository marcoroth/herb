# Linter Rule: Attributes must not have empty values

**Rule:** `html-no-empty-attributes`

## Description

Warn when certain restricted attributes are present but have an empty string as their value. These attributes are required to have meaningful values to function properly, and leaving them empty is typically either a mistake or unnecessary.

In most cases, if the value is not available, it's better to omit the attribute entirely.

### Restricted attributes

- `id`
- `class`
- `name`
- `for`
- `src`
- `href`
- `title`
- `data`
- `role`
- `data-*`
- `aria-*`

## Rationale

Many HTML attributes are only useful when they carry a value. Leaving these attributes empty can:

- Produce confusing or misleading markup (e.g., `id=""`, `class=""`)
- Create inaccessible or invalid HTML
- Interfere with CSS or JS selectors expecting meaningful values
- Indicate unused or unfinished logic in ERB

This rule helps ensure that required attributes are only added when they are populated.

## Examples

### ✅ Good

```erb
<div id="header"></div>
<img src="/logo.png" alt="Company logo">
<input type="text" name="email" autocomplete="off">

<!-- Dynamic attributes with meaningful values -->
<div data-<%= key %>="<%= value %>" aria-<%= prop %>="<%= description %>">
  Dynamic content
</div>

<!-- if no class should be set, omit it completely -->
<div>Plain div</div>
```

### 🚫 Bad

```erb
<div id=""></div>
<img src="" alt="Company logo">
<input name="" autocomplete="off">

<div data-config="">Content</div>
<button aria-label="">×</button>

<div class="">Plain div</div>

<!-- Dynamic attribute names with empty static values -->
<div data-<%= key %>="" aria-<%= prop %>="   ">
  Problematic dynamic attributes
</div>
```

## References

- [HTML Living Standard - Global attributes](https://html.spec.whatwg.org/multipage/dom.html#global-attributes)
- [WCAG 2.2 - Text Alternatives](https://www.w3.org/WAI/WCAG22/Understanding/text-alternatives.html)
- [MDN - HTML attribute reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes)
- [ARIA in HTML](https://www.w3.org/TR/html-aria/)
