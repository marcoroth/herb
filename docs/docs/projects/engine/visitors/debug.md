---
outline: deep
---

# `DebugVisitor`

Annotates the rendered output with where it came from, so a rendered element can be traced back to the tag that produced it.

```ruby
require "herb/engine/visitors/debug_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::DebugVisitor.new])
```

The first top-level element of a template carries which template it is, and each ERB output tag is wrapped in a `<span style="display: contents">` carrying where in that template it was written:

| Attribute                            | On      | Says                                              |
|--------------------------------------|---------|---------------------------------------------------|
| `data-herb-debug-file-relative-path` | element | which template this is                            |
| `data-herb-debug-file-name`          | element | its basename                                      |
| `data-herb-debug-file-full-path`     | element | its full path                                     |
| `data-herb-debug-outline-type`       | both    | whether it is a view, a partial, or an ERB output |
| `data-herb-debug-attach-to-parent`   | element | that the template has more than one root          |
| `data-herb-debug-inserted`           | span    | that this span is Herb's and not the author's     |
| `data-herb-debug-erb`                | span    | the tag as it was written                         |
| `data-herb-debug-line`, `-column`    | span    | where that tag is                                 |
| `data-herb-debug-node`               | both    | which render this was, with `node: true`          |

## Tracing rendered output back to a tag

`<%= link_to "Abc", "" %>` produces an `<a>` that says nothing about where it came from. Wrapping it says so:

```html
<span
  data-herb-debug-inserted="true"
  data-herb-debug-line="2"
  data-herb-debug-column="7"
  data-herb-debug-erb="&lt;%= link_to &quot;Abc&quot;, &quot;&quot; %&gt;"
  style="display: contents;"
>
  <a href="">Abc</a>
</span>
```

Anything looking at the rendered page, such as a linter running over the response, walks up from the element it has a finding about and takes the first marker it meets:

| Nearest marker                         | What it can say                  |
|----------------------------------------|----------------------------------|
| `[data-herb-debug-inserted]`           | the tag, and its line and column |
| `[data-herb-debug-file-relative-path]` | only the template                |
| neither                                | nothing                          |

Not every element ends up under a marker. An element written as plain HTML has no tag to name, an ERB tag inside an attribute value cannot be wrapped in a span, a template with more than one root only marks the first, and helpers that take a block are skipped. Treat a missing marker as unattributed rather than assuming coverage.

`node: true` adds the render as well, which needs `InstrumentationVisitor` in the same stack to have anything to report:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::DebugVisitor.new(node: true),
  Herb::Engine::InstrumentationVisitor.new
])
```

Without it the markers say only where in a file something was written, so a partial rendered three times puts three identical ones in the page. With it each carries the render it belongs to, which is what tells them apart.

The wrapper is a real cost. A `<span>` is not valid everywhere an ERB tag can appear, `<ul>` being the obvious case, so a strict linter reading the rendered page will have findings about Herb's own instrumentation.
