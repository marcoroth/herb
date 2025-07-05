# Linter Rule: No block elements inside inline elements

**Rule:** `html-no-block-inside-inline`

## Description

Prevent block-level elements from being placed inside inline elements.

## Rationale

Placing block-level elements (like `<div>`, `<p>`, `<section>`) inside inline elements (like `<span>`, `<a>`, `<strong>`) violates HTML content model rules and may lead to unpredictable rendering behavior across browsers.

This practice can cause:
- Invalid HTML that fails validation
- Inconsistent rendering across different browsers
- Layout issues and unexpected visual results
- Accessibility problems with screen readers

## Examples


### ✅ Good

```erb
<span>
  Hello <strong>World</strong>
</span>

<div>
  <p>Paragraph inside div (valid)</p>
</div>

<a href="#">
  <img src="icon.png" alt="Icon">
  <span>Link text</span>
</a>
```

### 🚫 Bad

```erb
<span>
  <div>Invalid block inside span</div>
</span>

<span>
  <p>Paragraph inside span (invalid)</p>
</span>

<a href="#">
  <div class="card">
    <h2>Card title</h2>
    <p>Card content</p>
  </div>
</a>

<strong>
  <section>Section inside strong</section>
</strong>
```

## References

* [HTML Living Standard - Content models](https://html.spec.whatwg.org/multipage/dom.html#content-models)
* [MDN - Block-level elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements)
* [MDN - Inline elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Inline_elements)
