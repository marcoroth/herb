---
outline: deep
---

# `HTMLSafeAssertionsVisitor`

Wraps the receiver of every `.html_safe` call in a template with a runtime assertion, so that marking a value as HTML-safe raises when the value contains HTML that the browser executes.

```ruby
require "herb/engine/visitors/html_safe_assertions_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::HTMLSafeAssertionsVisitor.new])
```

This template:

```html+erb
<div><%= @user.bio.html_safe %></div>
```

Compiles as if it had been written as:

```html+erb
<div><%= ::Herb::Engine::Runtime::HTMLSafeAssertions.check(@user.bio, file: __FILE__, line: 1, column: 6, source: "<%= @user.bio.html_safe %>", mode: :raise).html_safe %></div>
```

The value keeps flowing through `.html_safe` unchanged, and the assertion runs on every render. A value that is already HTML-safe is never checked, since `.html_safe` is a no-op on it.

The calls are found in the Prism program that the [`prism_program`](/parser-options) parser option attaches to the document, so a call is wrapped wherever it appears, including in control flow such as `<% elsif b.html_safe %>`. Calls inside an ERB comment are not wrapped, since they are not part of the program. The visitor declares the option through `required_parser_option`, which the engine turns on for it. Parsing an AST for this visitor by hand needs the same option:

```ruby
Herb.parse(source, prism_program: true)
```

The error surfaces while the template renders, not while it compiles, unlike the ones the [validators](/projects/engine#validators) raise. Rendering the template with a bio of `<script>alert(1)</script>` raises `Herb::Engine::Runtime::HTMLSafeAssertions::UnsafeHTMLError`:

```
Unsafe `.html_safe` call in app/views/users/show.html.erb:1:6

    <%= @user.bio.html_safe %>

The value contains a `<script>` element, which the browser executes.

    "<script>alert(1)</script>"

Escape the value or run it through `sanitize` instead of marking it as HTML-safe.
```

The value is checked against these heuristics:

| Check            | Reports                                                           |
|------------------|-------------------------------------------------------------------|
| `script_element` | A `<script>` element                                              |
| `event_handler`  | An inline event handler attribute, such as `onerror` or `onclick` |
| `javascript_url` | A `javascript:` or `vbscript:` URL                                |
| `data_url`       | A `data:text/html` URL                                            |
| `risky_element`  | An `<iframe>`, `<object>`, `<embed>`, `<base>` or `<portal>`      |
| `meta_refresh`   | A `<meta http-equiv="refresh">` element                           |

The visitor takes the following options:

| Option      | Default  | Description                                                                             |
|-------------|----------|-----------------------------------------------------------------------------------------|
| `mode`      | `:raise` | `:raise` raises on a violation, `:warn` warns and keeps rendering                       |
| `ignore`    | `[]`     | Checks to skip, given by name                                                           |
| `file_path` | `nil`    | Path baked into the assertion. Defaults to `__FILE__`, which Rails sets to the template |

```ruby
Herb::Engine::HTMLSafeAssertionsVisitor.new(mode: :warn, ignore: [:risky_element])
```

Set `on_violation` to report violations somewhere else instead of raising or warning. It receives the same error object, and is consulted before `mode`:

```ruby
Herb::Engine::Runtime::HTMLSafeAssertions.on_violation = ->(error) do
  ErrorTracking.capture_exception(error)
end
```

`.html_safe` passed as a block argument has no receiver to wrap, so the symbol becomes a block that checks every element it is called with:

```html+erb
<%= items.map(&:html_safe).join %>
```

```html+erb
<%= items.map(&proc { |value| ::Herb::Engine::Runtime::HTMLSafeAssertions.check(value, ...).html_safe }).join %>
```

Since the assertions run on every render, this visitor is meant for development and test environments. In production, either leave it out or run it with `mode: :warn`.
