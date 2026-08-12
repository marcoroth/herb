# Linter Rule: Disallow content arguments for void Action View elements

**Rule:** `actionview-no-void-element-content`

## Description

Void HTML elements like `img`, `br`, and `hr` cannot have content. When using Action View helpers like `tag.img` or `content_tag :img`, passing a positional content argument will raise a runtime error in Rails.

## Rationale

In Rails, `tag.*` helpers for void elements do not accept positional arguments for content. Calling `tag.img "/image.png"` raises `wrong number of arguments (given 1, expected 0)` at runtime.

The correct way to set attributes on void elements is to use keyword arguments, such as `tag.img src: "/image.png"`. This rule catches the error at lint time before it reaches production.

## Examples

### Good

```erb
<%= tag.img src: "/image.png", alt: "Photo" %>
```

```erb
<%= tag.br %>
```

```erb
<%= tag.hr class: "divider" %>
```

```erb
<%= content_tag :img, src: "/image.png", alt: "Photo" %>
```

### Bad

```erb
<%= tag.img "/image.png" %>
```

```erb
<%= tag.br "hello" %>
```

```erb
<%= content_tag :img, "hello" %>
```

```erb
<%= content_tag :br, "hello" %>
```

## References

* [Rails `ActionView::Helpers::TagHelper#tag`](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
* [Rails `ActionView::Helpers::TagHelper#content_tag`](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)
* [HTML Void Elements](https://html.spec.whatwg.org/multipage/syntax.html#void-elements)
