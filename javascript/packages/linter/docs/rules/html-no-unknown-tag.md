# Linter Rule: Disallow unknown HTML tags

**Rule:** `html-no-unknown-tag`

## Description

Disallow HTML elements that are not part of the HTML Living Standard. Non-standard tags like `<hello>` or `<foo>` are almost always typos or mistakes and should be flagged.

## Rationale

Browsers will render unknown HTML elements as inline elements with no special behavior, creating an `HTMLUnknownElement` instance. This is rarely intentional and usually indicates a typo or a misunderstanding of the available HTML elements.

Custom elements (tags containing a hyphen, like `<turbo-frame>` or `<my-component>`) are valid per the Web Components specification and are always allowed.

This rule also checks Action View tag helpers like `<%= tag.hello %>`, since the parser resolves these to their corresponding HTML elements. Note that `tag.my_component` is automatically translated to `<my-component>` by Rails and will not trigger this rule.

## Examples

### ✅ Good

```html
<div></div>
<span></span>
<section></section>
<img src="logo.png" alt="Logo">
```

```html
<turbo-frame id="messages"></turbo-frame>
<my-component></my-component>
```

```html
<Button></Button>
<UI::Button></UI::Button>
```

```html
<svg viewBox="0 0 24 24">
  <path d="M0 0h24v24H0z"></path>
  <circle cx="12" cy="12" r="10"></circle>
</svg>
```

```html
<math>
  <mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>
</math>
```

```erb
<%= tag.div do %>content<% end %>
<%= tag.my_component do %>content<% end %>
```

### 🚫 Bad

```html
<hello></hello>
```

```html
<foo></foo>
```

```html
<my_component></my_component>
```

```erb
<%= tag.hello do %>content<% end %>
```

## References

- [HTML Living Standard: Elements](https://html.spec.whatwg.org/multipage/indices.html#elements-3)
- [MDN: HTMLUnknownElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLUnknownElement)
- [HTML Living Standard: Valid custom element name](https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name)
