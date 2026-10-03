---
outline: deep
---

# `ScopedStyle::Visitor` <Badge type="warning" text="experimental" />

`ScopedStyle::Visitor` scopes a `<style scoped>` block to the markup written in the same file, similar to how Vue and Svelte scope a component's styles. It marks the file's elements with a scope attribute derived from its path, and narrows the block's selectors to require it, so the block styles those elements and nothing else.

It transforms this:

```html
<style scoped>
  .title { color: red; }
</style>

<h1 class="title">Hi</h1>
```

into this:

```html
<style>
  .title[data-herb-scope-1a2b3c4d] {
    color: red;
  }
</style>

<h1 class="title" data-herb-scope-1a2b3c4d>Hi</h1>
```

Every element the file wrote carries the scope, and every rule is narrowed by that attribute. Markup the file rendered carries a scope of its own or none, so a scoped block reaches what the file wrote and nothing else, whatever is nested inside it. That holds without the file having to know whether it renders anything.

The visitor does not rewrite the CSS itself. It passes the CSS to a `transform`, and the [`lightningcss`](https://github.com/marcoroth/lightningcss-ruby) gem is the one it reaches for unless something else is given, so each rule in a block is narrowed to the scope without anything being said:

```ruby
Herb::Engine::ScopedStyle::Visitor.new
```

Herb does not depend on `lightningcss`, so a machine without it gets a block left as it was written and a diagnostic saying so. Pass a `transform` to narrow the CSS some other way.

```ruby
require "herb/engine/scoped_style/visitor"
require "lightningcss"

Herb::Engine.new(source, filename: path, visitors: [
  Herb::Engine::ScopedStyle::Visitor.new(transform: LightningCSS::Transformer.new)
])
```

The `herb compile --scoped-styles` and `herb render --scoped-styles` commands wire the same thing up from the command line, installing `lightningcss` the first time if it is not already there.

With no `transform` at all, the block is left as it was written and a diagnostic reports it, because scoping the markup while leaving the CSS untouched would turn a scoped block into a global one. The same holds for a block built with ERB, which has no CSS to read at compile time, and for a template compiled without a `filename`, which has no stable scope to derive. A `transform` that raises is treated the same way, so CSS nobody can read costs the block it was written in and not the whole template.

`deliver` says where the narrowed CSS goes.

| Value     | Description                                                                             |
|-----------|-----------------------------------------------------------------------------------------|
| `:inline` | Leaves the block where it was written. This is the default. It needs nothing else installed, and writes the block again on every render of the file. |
| `:hoist`  | Takes the block out and registers the CSS on a [channel](/projects/engine#delivering-something-other-than-diagnostics) of the session the page is collecting into, so it is written once however many times the file renders. Needs `Herb::Engine::Runtime::Middleware` to put it on the page. |
| `:none`   | Takes the block out and puts nothing in its place, for when the CSS was already gathered into an asset. The markup still carries its scope attribute. |

It is set alongside `transform`:

```ruby
Herb::Engine::ScopedStyle::Visitor.new(transform: transform, deliver: :hoist)
```

### Supplying your own transform

Lightning CSS is one way to narrow the CSS, and not the only one. `transform` is any object that answers `call`. The visitor hands it the block's CSS and the scope, and reads a narrowed stylesheet back, so a different CSS engine or a hand-written rewriter fits the same slot.

| Argument       | Type     | Description                                              |
|----------------|----------|----------------------------------------------------------|
| `css`          | `String` | The block's CSS, exactly as it was written               |
| `scope:`       | `String` | A selector fragment every rule has to be narrowed by     |
| *return value* | any      | Anything whose `to_s` is the narrowed CSS                |

```ruby
transform.call(".title { color: red }", scope: "[data-herb-scope-1a2b3c4d]")
#=> ".title[data-herb-scope-1a2b3c4d] { color: red }"
```

A return value answering `warnings` has each of them reported as a diagnostic, which is how a `LightningCSS::Result` surfaces what Lightning CSS kept without acting on. CSS a transform could not act on is CSS that does nothing once the page renders, so it is worth saying so at compile time. A transform answering with a plain string reports nothing.
