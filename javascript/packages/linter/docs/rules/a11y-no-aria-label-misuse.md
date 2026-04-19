# Linter Rule: No ARIA label misuse

**Rule:** `a11y-no-aria-label-misuse`

## Description

Disallow misuse of `aria-label` and `aria-labelledby` on elements where accessible names are not reliably supported.

## Rationale

`aria-label` and `aria-labelledby` should not be used as a generic replacement for visible text. These attributes are only dependable on elements that support author-provided accessible names.

This rule:

- disallows these attributes on `h1`-`h6`, `strong`, `i`, `p`, `b`, and `code`
- requires `div` and `span` to have a permitted ARIA `role`
- disallows `div` and `span` roles that cannot be named

When the `role` value is dynamic and cannot be determined statically, the rule does not report an offense.

## Examples

### ✅ Good

```erb
<button aria-label="Close">
  <svg></svg>
</button>
```

```erb
<a aria-labelledby="details-heading" href="/details">
  Open
</a>
```

```erb
<div role="dialog" aria-labelledby="dialog-heading">
  <h1 id="dialog-heading">Dialog title</h1>
</div>
```

```erb
<span role="img" aria-label="Warning"></span>
```

### 🚫 Bad

```erb
<span aria-label="Tooltip">I am some text.</span>
```

```erb
<div aria-labelledby="heading1">Goodbye</div>
```

```erb
<h1 aria-label="This will override the page title completely">Page title</h1>
```

```erb
<span role="presentation" aria-label="Decorative icon"></span>
```

## References

- [erblint-github: `GitHub::Accessibility::NoAriaLabelMisuse`](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/no_aria_label_misuse.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-aria-label-misuse.md)
- [WAI-ARIA: roles which cannot be named](https://w3c.github.io/aria/#namefromprohibited)
- [Not so short note on aria-label usage](https://html5accessibility.com/stuff/2020/11/07/not-so-short-note-on-aria-label-usage-big-table-edition/)
- [Primer: Tooltip alternatives](https://primer.style/design/accessibility/tooltip-alternatives)
