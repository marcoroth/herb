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

## Across call sites

This rule also considers where a file is rendered. When the linter runs over a whole project it resolves the HTML ancestors that each call site places a file inside, following `render` calls and each template's conventional layout `yield`.

An interactive element at the top level of a partial is reported when every call site renders that partial inside another interactive element.

Action View helpers that render an element count as ancestors, so a `content_tag`, `tag.div` or `link_to` block nests what it wraps just like the equivalent HTML would.

The rule stays quiet whenever there is not enough information to be sure. A file nothing renders, and a chain that never reaches a layout, are both left alone. When only some call sites nest the file, the offense is still reported and the call chain points at one that does, since the nesting is real on that code path.

Layout resolution follows Rails' naming convention and cannot see a controller declaring `layout "..."` or `layout false`.

## References

- [erblint-github: NestedInteractiveElements](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/nested_interactive_elements.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/nested-interactive-elements.md)
- [Deque University: nested-interactive](https://dequeuniversity.com/rules/axe/4.8/nested-interactive)
- [Accessibility Insights](https://accessibilityinsights.io/info-examples/web/nested-interactive/)
