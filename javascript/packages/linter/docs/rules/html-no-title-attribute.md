# Linter Rule: Avoid using the `title` attribute

**Rule:** `html-no-title-attribute`

## Description

Discourage the use of the `title` attribute on most HTML elements, as it provides poor accessibility and user experience. The `title` attribute is only accessible via mouse hover and is not reliably exposed to screen readers or keyboard users.

## Rationale

The `title` attribute has several accessibility problems:
- It's only visible on mouse hover, making it inaccessible to keyboard and touch users
- Screen readers don't consistently announce title attributes
- Mobile devices don't show title tooltips
- The visual presentation is inconsistent across browsers and operating systems

Instead of relying on `title`, use visible text, `aria-label`, `aria-describedby`, or other accessible alternatives.

::: warning Exceptions
This rule allows `title` on `<iframe>` and `<link>` elements where it serves specific accessibility purposes.
:::

## Examples

### ✅ Good

```erb
<!-- Use visible text instead of title -->
<button>Save document</button>
<span class="help-text">Click to save your changes</span>

<!-- Use aria-label for accessible names -->
<button aria-label="Close dialog">×</button>

<!-- Use aria-describedby for additional context -->
<input type="password" aria-describedby="pwd-help" autocomplete="off">
<div id="pwd-help">Password must be at least 8 characters</div>

<!-- Exceptions: title allowed on iframe and links -->
<iframe src="https://example.com" title="Example website content"></iframe>
<link href="default.css" rel="stylesheet" title="Default Style">
```

### 🚫 Bad

```erb
<!-- Don't use title for essential information -->
<button title="Save your changes">Save</button>

<div title="This is important information">Content</div>

<span title="Required field">*</span>

<!-- Don't use title on form elements -->
<input type="text" title="Enter your name" autocomplete="off">

<select title="Choose your country">
  <option>US</option>
  <option>CA</option>
</select>
```

## References

- [HTML: `title` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
- [WebAIM: Accessible Forms](https://webaim.org/techniques/forms/)
- [ARIA: `aria-label` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)
- [ARIA: `aria-describedby` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby)
- [erblint-github: GitHub::Accessibility::NoTitleAttribute](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/no-title-attribute.md)
