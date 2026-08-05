# Linter Rule: `<details>` elements must have a `<summary>` child

**Rule:** `html-details-has-summary`

## Description

Ensure that all `<details>` elements have a direct `<summary>` child element that describes what the disclosure widget will expand.

## Rationale

The `<summary>` element provides a visible label for the `<details>` disclosure widget, hinting to the user what they'll be expanding. Screen reader users rely on `<summary>` elements to understand the purpose of the expandable content. If a developer omits the `<summary>`, the user agent adds a default one with no meaningful context. The `<summary>` must be a direct child of `<details>` to function correctly — nesting it inside another element will not work as intended.

## Examples

### ✅ Good

```erb
<details>
  <summary>Expand me!</summary>
  I do have a summary tag!
</details>

<details>
  I do have a summary tag!
  <summary>Expand me!</summary>
</details>
```

### 🚫 Bad

```erb
<details>
  I don't have a summary tag!
</details>

<details>
  <div><summary>Expand me!</summary></div>
  The summary tag needs to be a direct child of the details tag.
</details>
```

## References

- [HTML: `details` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- [HTML: `summary` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/summary)
- [erblint-github: GitHub::Accessibility::DetailsHasSummary](https://github.com/github/erblint-github/pull/23)
