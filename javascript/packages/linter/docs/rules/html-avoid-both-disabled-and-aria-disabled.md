# Linter Rule: Avoid using both `disabled` and `aria-disabled` attributes

**Rule:** `html-avoid-both-disabled-and-aria-disabled`

## Description

Prevent using both the native `disabled` attribute and the `aria-disabled` attribute on the same HTML element. Elements should use either the native `disabled` attribute or `aria-disabled`, but not both.

## Rationale

Using both `disabled` and `aria-disabled` on the same element creates redundancy and potential confusion for assistive technologies. The native `disabled` attribute provides both visual and functional disabling, while `aria-disabled` only provides semantic information without preventing interaction. Having both can lead to inconsistent behavior and unclear expectations for users.

Elements that support the native `disabled` attribute include: `button`, `fieldset`, `input`, `optgroup`, `option`, `select`, and `textarea`.

## Examples

### ✅ Good

```erb
<!-- Use only the native disabled attribute -->
<button disabled>Submit</button>
<input type="text" autocomplete="off" disabled>

<!-- Use only aria-disabled for custom elements -->
<div role="button" aria-disabled="true">Custom Button</div>

<!-- Use only aria-disabled -->
<button aria-disabled="true">Submit</button>
```

### 🚫 Bad

```erb
<!-- Both disabled and aria-disabled -->
<button disabled aria-disabled="true">Submit</button>

<input type="text" autocomplete="off" disabled aria-disabled="true">

<select disabled aria-disabled="true">
  <option>Option 1</option>
</select>
```

## References

- [HTML: `disabled` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled)
- [ARIA: `aria-disabled` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)
- [erblint-github: GitHub::Accessibility::AvoidBothDisabledAndAriaDisabled](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/avoid-both-disabled-and-aria-disabled.md)
