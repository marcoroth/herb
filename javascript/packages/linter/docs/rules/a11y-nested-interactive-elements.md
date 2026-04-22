# Linter Rule: No nested interactive elements

**Rule:** `a11y-nested-interactive-elements`

## Description

Disallow nesting interactive elements inside other interactive elements. Interactive controls such as `<button>`, `<summary>`, `<input>`, `<select>`, `<textarea>`, or `<a>` must not contain other interactive elements.

## Rationale

Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.

## Exceptions

- `<a>` inside `<summary>` is allowed.
- `<input type="hidden">` is not considered an interactive element.

## Examples

### ✅ Good

```erb
<button>Confirm</button>
```

```erb
<a href="/about">About</a>
```

```erb
<div><a href="/about">About</a></div>
```

```erb
<summary><a href="/about">About</a></summary>
```

```erb
<button><input type="hidden" name="token" /></button>
```

### 🚫 Bad

```erb
<button><a href="https://github.com/">Go to GitHub</a></button>
```

```erb
<a href="/about"><button>Click</button></a>
```

```erb
<button><select><option>A</option></select></button>
```

```erb
<button><input type="text" /></button>
```

## References

- [erblint-github: NestedInteractiveElements](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/nested_interactive_elements.rb)
- [Deque University: nested-interactive](https://dequeuniversity.com/rules/axe/4.2/nested-interactive)
- [Accessibility Insights](https://accessibilityinsights.io/info-examples/web/nested-interactive/)
