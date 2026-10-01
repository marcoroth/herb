---
outline: deep
---

# `CSSInliner::Visitor` <Badge type="warning" text="experimental" />

A `style` attribute is the only way to say something an email client reads, and `CSSInliner::Visitor` is how a stylesheet gets there.

A stylesheet, and a template that never mentions it:

:::code-group
```css [app/assets/style.css]
h1 {
  color: #1a1a1a;
  font-family: Helvetica, Arial, sans-serif;
}
```

```erb [app/views/mail.html.erb]
<h1>Welcome, <%= name %></h1>

<p>Thanks for signing up.</p>
```
:::

Compiled with the visitor, and given the stylesheet to read:

```ruby
require "herb/engine/css_inliner/visitor"

Herb::Engine.new(
  source,
  filename: "app/views/mail.html.erb",
  project_path: root,
  visitors: [
    Herb::Engine::CSSInliner::Visitor.new(
      stylesheets: ["app/assets/style.css"]
    )
  ]
)
```

What renders:

```html
<h1 style="color: #1a1a1a;font-family: Helvetica, Arial, sans-serif;">Welcome, Marco</h1>

<p>Thanks for signing up.</p>
```

The `<h1>` carries what the stylesheet said about it, the `<p>` carries nothing because nothing was said about it, and there is no `<style>` block left for a mail client to throw away.

The CSS is matched against the markup once the file has rendered, not when it is compiled, because that is the first moment the markup exists. Nothing about the page the file landed in has to be known to do it: the CSS and the markup it applies to arrive in the same buffer.

Every `<style>` block the template rendered is inlined, whoever wrote it. A block the author wrote by hand, and a block `ScopedStyle::Visitor` narrowed, are both read out of the markup. `stylesheets` are files read when the template is compiled and written into it as a block of their own, so nothing reads a file to render one and the CSS a template was compiled against cannot change under it.

Because it inlines every block it finds, this belongs in a stack that wants all of its CSS on the elements. That is what an email wants. A page that meant a `<style>` block to stay one does not.

`stylesheets` are read in the order they are given, so the last one to say something is the one that says it:

```ruby
Herb::Engine::CSSInliner::Visitor.new(stylesheets: ["app/assets/base.css", "app/assets/theme.css"])
```

What does the writing is built the first time a template renders, so putting the visitor in a stack is the only thing that has to be said. It reaches for the [`css_inline`](https://github.com/Stranger6667/css-inline) gem, which Herb does not depend on, and reports it when a template is compiled if it is not there.

Something else can be put in its place, and anything answering `inline_fragment` with the markup and a stylesheet fits:

```ruby
Herb::Engine::CSSInliner.inliner = MyInliner.new
```

If an inliner fails, the markup is answered as it was rendered: the blocks are still in it, so the CSS applies as it was written and a page is never worse off for asking.

Rules a `style` attribute cannot say, such as `@media`, `:hover` and `::before`, are dropped by an inliner instead of kept, so a template holding any keeps its blocks and says the rest twice. A block built with ERB is treated the same way, because what it holds is not knowable when the template is compiled. Which it is, is decided then.

What a template holds when this runs is what it decides about, so it has to run after anything that rewrites the blocks, and the stack raises if it does not. A `ScopedStyle::Visitor` delivering anywhere other than `:inline` takes its block out of the markup, and a template read before that happens is a template holding a block that will not be there to inline.


### Gathering the CSS ahead of time

A scope and its CSS are decided when a file is compiled, so everything a stylesheet needs is knowable before anything renders. `ScopedStyle::Collector` compiles a set of files for that and nothing else:

```ruby
require "herb/engine/scoped_style/collector"

collector = Herb::Engine::ScopedStyle::Collector.new(transform: transform, project_path: root)

collector.add("app/views/posts/_card.html.erb")
collector.add("app/views/posts/index.html.erb")

collector.to_css   #=> the one stylesheet those files add up to
collector.styles   #=> { "data-herb-scope-1a2b3c4d" => "..." }
collector.files    #=> which scopes each file contributed
collector.failures #=> the files it could not compile, and why
```

Paths are expanded before they are compiled, so the scopes it gathers are the ones the same files carry when your application compiles them. A file it cannot compile is recorded in `failures` and skipped, so one broken template does not take a build down.

Templates then compile with `deliver: :none` and emit no CSS at all, because the stylesheet already has it.

Which files to gather, where the stylesheet goes, and how it reaches the page is the job of whatever integrates Herb with a framework.

It has to run after `InlineRender::Visitor`, so that markup an inlined partial brought with it takes the partial's own scope, and before `Slots::Visitor`, because the markup `Slots::Visitor` parks for a client to rebuild has to carry the attribute already.
