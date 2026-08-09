# Linter Rule: No visually hidden interactive elements

**Rule:** `a11y-no-visually-hidden-interactive-elements`

## Description

Prevent keyboard-focusable elements from remaining visually hidden while they have focus.

## Rationale

Sighted keyboard users rely on a visible focus indicator to understand where they are on a page. When focus moves to an element hidden with `sr-only`, the focus indicator disappears and it can seem as though focus was lost.

## Recognized classes

This rule recognizes an `sr-only` class like the one Tailwind defines. It allows the following classes when they reveal the element by the time it receives keyboard focus:

- `not-sr-only`
- `focus:not-sr-only`
- `focus-visible:not-sr-only`
- `focus-within:not-sr-only`
- `group-focus-within:not-sr-only`

Responsive and other prefixes are supported, such as `md:focus:not-sr-only` and `dark:lg:focus-visible:not-sr-only`. Hover- and active-only variants are not considered focus reveals because they can leave the element hidden when keyboard focus first reaches it.

The rule also detects focusable elements inside an ancestor with `sr-only`. A hidden ancestor must use `not-sr-only` or a `focus-within:not-sr-only` variant to reveal its descendants. A plain `focus:not-sr-only` on the ancestor is not sufficient because focusing a descendant does not focus the ancestor itself.

The rule does not inspect CSS or detect arbitrary visually hidden classes. Class attributes containing ERB are skipped because a dynamic value could add one of the reveal classes.

::: info Configurability
The hidden and reveal class names are not currently configurable. A follow-up using configurable rule options will allow projects with other CSS conventions to use this check with their own classes.
:::

## Exceptions

- `input` elements are not reported because visually hidden inputs, such as file inputs and custom-styled checkboxes, are common and can otherwise produce false positives.
- Disabled controls and elements with a negative `tabindex` are not reported because they cannot be reached through sequential keyboard navigation.
- An `<a>` without `href` is only reported when a non-negative `tabindex` makes it keyboard-focusable.

## Reveal visually hidden elements with CSS

Projects that control their visually hidden CSS can avoid the problem at its source by defining the class so focused elements are revealed automatically. For example:

```css
.sr-only:not(:focus):not(:active):not(:focus-within) {
  clip-path: inset(50%);
  height: 1px;
  overflow: clip;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
```

With this definition, the visually hidden styles stop applying when the element receives focus, becomes active, or contains focus. Leave this rule disabled when your application already handles focus visibility this way.

## Examples

### ✅ Good

```erb
<h2 class="sr-only">Account settings</h2>
```

```erb
<span class="sr-only">Visually hidden text</span>
```

```erb
<button class="btn">Submit</button>
```

```erb
<a class="sr-only focus:not-sr-only" href="#main">Skip to content</a>
```

```erb
<button class="sr-only" disabled>Unavailable</button>
```

```erb
<div class="sr-only focus-within:not-sr-only">
  <button>Submit</button>
</div>
```

### 🚫 Bad

```erb
<button class="sr-only">Submit</button>
```

```erb
<a class="sr-only" href="/about">About</a>
```

```erb
<div class="sr-only" tabindex="0">Open menu</div>
```

```erb
<div class="sr-only">
  <button>Submit</button>
</div>
```

## Across call sites

This rule considers the classes on ancestors at each call site. A focusable element in a partial is reported when every call site, or at least one call site, renders it inside an ancestor hidden with `sr-only`.

When callers disagree, the detailed formatter includes a call chain pointing to one that hides the element. The chain follows `render` calls and each template's conventional layout `yield`, making it possible to trace the hidden control back to the responsible ancestor.

Action View helpers such as `content_tag`, `tag.div`, and block-form `link_to` calls are included in the element context shown for each call site.

A file with no known callers or only unresolved render chains is left alone when its local markup does not establish an offense. Dynamic ancestor class values are also skipped because the rule cannot know whether they hide or reveal the element.

Layout resolution follows Rails' naming convention and cannot see a controller declaring `layout "..."` or `layout false`.

## References

- [Inspired by erblint-github's `NoVisuallyHiddenInteractiveElements`](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/no_visually_hidden_interactive_elements.rb)
- [Original erblint-github documentation](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-visually-hidden-interactive-elements.md)
