---
outline: deep
---

# `ContentForVisitor`

Appends HTML to the end of every element matching a tag name, so that it ends up right before that element's closing tag.

```ruby
require "herb/engine/visitors/content_for_visitor"

Herb::Engine.new(source, visitors: [
  Herb::Engine::ContentForVisitor.new("<p>Footer</p>", tag_name: "main")
])
```

Tag names are matched case-insensitively, and every matching element in the template gets the content, including nested ones.

Pass `attributes` to narrow which elements match. Every condition in the hash has to hold:

```ruby
Herb::Engine::ContentForVisitor.new(
  "<p>Footer</p>",
  tag_name: "main",
  attributes: { "id" => "content", "data-role" => /page/, "hidden" => false }
)
```

| Condition     | Matches when                                 |
|---------------|----------------------------------------------|
| `true`        | The attribute is present, whatever its value |
| `false`       | The attribute is absent                      |
| A `Regexp`    | The attribute value matches it               |
| Anything else | The attribute value is equal to it           |

Attribute names are matched case-insensitively, and may be given as strings or symbols. An attribute whose value is built from ERB has no value known at compile time, so it matches `true` but never a string or `Regexp` condition.

Multiple visitors compose, and each appends after the last, in the order you pass them.

Given this template and a visitor for the `head` tag:

```html+erb
<head>
  <title>Hello</title>
</head>
```

The engine renders:

```html
<head>
  <title>Hello</title>
<meta name="herb" content="1"></head>
```

The content is emitted as a Ruby string literal marked `html_safe`, so it is never escaped, and quotes, backslashes and `#{}` in it are not interpreted.
