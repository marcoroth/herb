# Linter Rule: Focusable elements should not have `aria-hidden="true"`

**Rule:** `html-no-aria-hidden-on-focusable`

## Description

Prevent using `aria-hidden="true"` on elements that can receive keyboard focus. When an element is focusable but hidden from screen readers, it creates a confusing experience where keyboard users can tab to "invisible" elements.

## Rationale

Elements with `aria-hidden="true"` are completely hidden from assistive technologies, but they remain visible and interactive for mouse and keyboard users. If a focusable element is hidden from screen readers, keyboard-only users (especially those using screen readers) will encounter focused elements that provide no accessible information, creating a broken user experience.

## Examples

### ✅ Good

```erb
<button>Submit</button>
<a href="/link">Link</a>
<input type="text" autocomplete="off">
<textarea></textarea>

<div aria-hidden="true">Decorative content</div>
<span aria-hidden="true">🎉</span>

<button tabindex="-1" aria-hidden="true">Hidden button</button>
```

### 🚫 Bad

```erb
<button aria-hidden="true">Submit</button>

<a href="/link" aria-hidden="true">Link</a>

<input type="text" autocomplete="off" aria-hidden="true">

<textarea aria-hidden="true"></textarea>

<select aria-hidden="true">
  <option>Option</option>
</select>

<div tabindex="0" aria-hidden="true">Focusable div</div>

<a href="/link" aria-hidden="true">Hidden link</a>
```

## References

- [ARIA: `aria-hidden` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden)
- [HTML: `tabindex` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex)
- [WebAIM: Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [erblint-github: GitHub::Accessibility::NoAriaHiddenOnFocusable](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-aria-hidden-on-focusable.md)
