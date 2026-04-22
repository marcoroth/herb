# Linter Rule: No visually hidden interactive elements

**Rule:** `a11y-no-visually-hidden-interactive-elements`

## Description

Enforce that interactive elements are not visually hidden using classes like `sr-only`.

## Rationale

Visually hiding interactive elements can be confusing to sighted keyboard users as it appears their focus has been lost when they navigate to the hidden element.

Note: `input` elements are not flagged at this time as some visually hidden inputs might cause false positives (e.g. file inputs).

## Examples

### ✅ Good

```erb
<h2 class="sr-only">Welcome to GitHub</h2>
```

```erb
<span class="sr-only">Visually hidden text</span>
```

```erb
<button class="btn">Submit</button>
```

### 🚫 Bad

```erb
<button class="sr-only">Submit</button>
```

```erb
<a class="sr-only" href="/about">About</a>
```

```erb
<summary class="sr-only">Details</summary>
```

```erb
<select class="sr-only"><option>A</option></select>
```

```erb
<textarea class="sr-only"></textarea>
```

## References

- [erblint-github: NoVisuallyHiddenInteractiveElements](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/no_visually_hidden_interactive_elements.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-visually-hidden-interactive-elements.md)
