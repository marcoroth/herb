# Linter Rule: Disabled Attribute

**Rule:** `a11y-disabled-attribute`

## Description

The `disabled` attribute is only valid on certain HTML elements. Using it on other elements has no effect and may confuse users or assistive technologies.

## Rationale

The HTML `disabled` attribute is a boolean attribute that only applies to form-related elements: `button`, `input`, `textarea`, `option`, `select`, `fieldset`, `optgroup`, and `task-lists`. Applying it to other elements like `<a>`, `<div>`, or `<span>` has no native browser behavior and can be misleading.

## Examples

### ✅ Good

```erb
<button disabled>Continue</button>
```

```erb
<input type="text" disabled>
```

```erb
<select disabled><option>A</option></select>
```

### 🚫 Bad

```erb
<a href="https://github.com/" disabled>Go to GitHub</a>
```

```erb
<div disabled>Content</div>
```

```erb
<span disabled>Text</span>
```

## References

- [erblint-github: `DisabledAttribute`](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/disabled_attribute.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/disabled-attribute.md)
- [MDN: HTML attribute `disabled`](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled)
