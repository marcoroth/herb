# Linter Rule: Avoid positive `tabindex` values

**Rule:** `html-no-positive-tab-index`

## Description

Prevent using positive values for the `tabindex` attribute. Only `tabindex="0"` (to make elements focusable) and `tabindex="-1"` (to remove from tab order) should be used.

## Rationale

Positive `tabindex` values create a custom tab order that can be confusing and unpredictable for keyboard users. They override the natural document flow and can cause elements to be focused in an unexpected sequence. This breaks the logical reading order and creates usability issues, especially for screen reader users who rely on a predictable navigation pattern.

The recommended approach is to structure your HTML in the correct tab order and use `tabindex="0"` only when you need to make non-interactive elements focusable, or `tabindex="-1"` to remove elements from the tab sequence while keeping them programmatically focusable.

## Examples

### ✅ Good

```erb
<!-- Natural tab order (no tabindex needed) -->
<button>First</button>
<button>Second</button>
<button>Third</button>

<!-- Make non-interactive element focusable -->
<div tabindex="0" role="button">Custom button</div>

<!-- Remove from tab order but keep programmatically focusable -->
<button tabindex="-1">Skip this in tab order</button>

<!-- Zero tabindex to ensure focusability -->
<span tabindex="0" role="button">Focusable span</span>
```

### 🚫 Bad

```erb
<button tabindex="3">Third in tab order</button>

<button tabindex="1">First in tab order</button>

<button tabindex="2">Second in tab order</button>

<input tabindex="5" type="text" autocomplete="off">

<button tabindex="10">Submit</button>
```

## References

- [HTML: `tabindex` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex)
- [WebAIM: Keyboard Accessibility](https://webaim.org/techniques/keyboard/tabindex)
- [WCAG: Focus Order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html)
- [erblint-github: GitHub::Accessibility::NoPositiveTabIndex](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-positive-tab-index.md)
