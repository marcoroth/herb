# Linter Rule: No `aria-label` misuse

**Rule:** `a11y-no-aria-label-misuse`

## Description

Enforce that `aria-label` and `aria-labelledby` are only used on interactive elements or elements with a permitted ARIA role.

## Rationale

`aria-label` and `aria-labelledby` support is only guaranteed on interactive elements like `button` or `a`, or on static elements like `div` and `span` with a permitted `role`. Using these attributes on non-interactive elements without a role, or on elements like headings, can lead to unexpected behavior with assistive technologies.

This rule will allow `aria-label` and `aria-labelledby` usage on `div` and `span` elements if set to a role other than the ones listed in [W3C: roles which cannot be named](https://w3c.github.io/aria/#namefromprohibited). This rule will never permit usage on `h1`–`h6`, `strong`, `i`, `p`, `b`, or `code`.

## Examples

### ✅ Good

```erb
<button aria-label="Close">
  <svg src="closeIcon"></svg>
</button>
```

```erb
<span>Hello</span>
```

```erb
<div role="dialog" aria-labelledby="dialogHeading">
  <h1 id="dialogHeading">Heading</h1>
</div>
```

```erb
<a href="/about" aria-label="About us">About</a>
```

### 🚫 Bad

```erb
<span aria-label="This is a tooltip">I am some text.</span>
```

```erb
<div aria-labelledby="heading1">Goodbye</div>
```

```erb
<h1 aria-label="This will override the page title completely">Page title</h1>
```

```erb
<div role="none" aria-label="Hidden">Content</div>
```

## References

- [erblint-github: NoAriaLabelMisuse](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/no_aria_label_misuse.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-aria-label-misuse.md)
- [W3C: roles which cannot be named](https://w3c.github.io/aria/#namefromprohibited)
- [Not so short note on aria-label usage](https://html5accessibility.com/stuff/2020/11/07/not-so-short-note-on-aria-label-usage-big-table-edition/)
