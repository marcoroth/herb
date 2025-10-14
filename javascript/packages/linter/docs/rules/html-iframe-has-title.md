# Linter Rule: `iframe` elements must have a `title` attribute

**Rule:** `html-iframe-has-title`

## Description

Ensure that all `iframe` elements have a meaningful `title` attribute that describes the content of the frame. The title should not be empty or contain only whitespace.

## Rationale

The `title` attribute on `iframe` elements provides essential context for screen reader users about what content the frame contains. Without this information, users of assistive technology cannot understand the purpose or content of the embedded frame, creating significant accessibility barriers.

::: tip Note
`<iframe>`'s with `aria-hidden="true"` are exempt from this requirement as they are hidden from assistive technologies.
:::

## Examples

### ✅ Good

```erb
<iframe src="https://youtube.com/embed/123" title="Product demonstration video"></iframe>
<iframe src="https://example.com" title="Example website content"></iframe>

<!-- Hidden from screen readers -->
<iframe aria-hidden="true"></iframe>
```

### 🚫 Bad

```erb
<iframe src="https://example.com"></iframe>

<iframe src="https://example.com" title=""></iframe>

<iframe src="https://example.com" title="   "></iframe>
```

## References

- [HTML: `iframe` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)
- [HTML: `title` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
- [erblint-github: GitHub::Accessibility::IframeHasTitle](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/iframe-has-title.md)
