---
outline: deep
---

# `InlineRender::Visitor` <Badge type="warning" text="experimental" />

Replaces a `render` of a static partial with the partial itself, so the rendered page costs no partial lookup at run time.

```ruby
require "herb/engine/inline_render/visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::InlineRender::Visitor.new])
```

`<%= render partial: "posts/card", locals: { title: @post.title } %>` compiles to the card's own markup, inside a lambda that takes the locals it was given as parameters:

```ruby
->(title) { _buf << '<div>'.freeze; _buf << (title).to_s; _buf << '</div>'.freeze; }.call((@post.title))
```

The lambda is what scopes them. A partial only ever sees the locals it was passed, so the copy has to work the same way, and a lambda's parameters are what make that true of the copy.

The locals a partial assigns for *itself* are declared block-local on the same lambda, so they do not reach the template's either:

```ruby
->(title; total) { ... }.call((@post.title))
```

`Prism` reports those from the partial's own source, which is exact rather than a guess. Without them a partial assigning a name the template already had a local for would assign over the template's, because a block body shares the locals around it rather than making its own.

A partial is inlined only when the file it names is knowable and inlining it means what the original did. That rules out a dynamic path, a block, `content_for`, `yield`, `local_assigns`, and one already being inlined further up, and it also rules out several things that are answered by where a partial is rather than by what it says:

| Left alone | Because |
|------------|---------|
| `t(".title")`, `l(...)`, `I18n.t` | The lookup is keyed on `@virtual_path`, which would become the template's |
| `card_iteration` | Rails binds it per item; the copy has only the counter |
| A name the template has a local for | The copy would read the local rather than call the method of that name |
| `cache` | Its fragment digest is keyed the same way |
| A partial declaring strict locals | Rails is the only one who can enforce them; the copy has no signature to check against |
| A partial in another format | Resolved in the template's own format instead, since the shared candidate order puts HTML first |
| A partial that does not parse | So the error is still reported against the partial |
| `<% render %>` that does not output | Rails throws its value away, so the markup was never asked for |

It has to run first, and the engine refuses a stack that puts it anywhere else. Everything after it sees the partial's markup as part of the template it landed in, which is what holds a partial to whatever the template around it is held to. A validator that refuses markup in a template refuses it in a partial, and a transform that rewrites a tag rewrites it wherever it was written. Were it to run last, moving markup into a partial would be a way of turning those off.

A partial that is inlined never renders, so nothing about it would reach the session either. What was moved is recorded on `Herb::Visitor::Context::Origin`, and `InstrumentationVisitor` reads it, so the page describes itself the same way whether the partial was inlined or rendered:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::InlineRender::Visitor.new,
  Herb::Engine::InstrumentationVisitor.new
])
```

```json
{ "id": "2", "template": "app/views/posts/_card.html.erb", "parent": "1", "line": 1, "column": 6, "via": "partial" }
```

A query issued inside an inlined partial is filed under the partial, not under the template it landed in, and a collection reports one render per item rather than one for all of them. The lines and columns need no adjusting, because the nodes came from the partial's own source.
