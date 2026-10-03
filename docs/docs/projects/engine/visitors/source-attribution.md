---
outline: deep
---

# `SourceAttributionVisitor`

Stamps every element with the template and the position it was written at, so a finding about the rendered page can be pointed back at the line that produced it.

```ruby
require "herb/engine/visitors/source_attribution_visitor"

Herb::Engine.new(source, filename: path, visitors: [Herb::Engine::SourceAttributionVisitor.new])
```

```html+erb
<div class="card">
  <h1>Title</h1>
</div>
```

```html
<div class="card" data-herb-source="app/views/posts/_card.html.erb:1:1">
  <h1 data-herb-source="app/views/posts/_card.html.erb:2:3">Title</h1>
</div>
```

The attribute is `data-herb-source` unless `attribute:` names another one.

Some things are only visible once a page is rendered. Two partials can each be valid on their own and still collide on an `id`, a heading order only exists once a layout and everything it renders are composed, and a `<form>` inside another `<form>` is usually two templates that never see each other. A linter reading the response answers those, and the positions it reports are offsets into the response, which is not a place anyone can go and fix anything. The stamp is what turns them back into a file and a line.

An element that renders many times carries the line it was written at, not the line it rendered at, so the answer to a duplicate `id` is the line that renders more than once:

```html
<ul data-herb-source="app/views/posts/_card.html.erb:1:1">
  <li data-herb-source="app/views/posts/_card.html.erb:3:5">a</li>
  <li data-herb-source="app/views/posts/_card.html.erb:3:5">b</li>
</ul>
```

A partial that `InlineRender::Visitor` brought into the template is stamped with the file it was written in, not the file it was inlined into.

## Tag helpers and the parser option

A tag helper is stamped too. The `action_view_helpers` parser option turns `<%= link_to "Home", "/" %>` into an `<a>` that the compiler writes out as markup, and that `<a>` is stamped at the position of the `<%=` that asked for it:

```html
<nav data-herb-source="app/views/posts/_card.html.erb:1:1">
  <a href="/" data-herb-source="app/views/posts/_card.html.erb:2:3">Home</a>
</nav>
```

This visitor declares that option with `recommended_parser_option`, so a stack that says nothing about it gets it.

The stamp is markup Herb added, so strip it before reporting positions back, and leave the visitor out of anything but a development build.
