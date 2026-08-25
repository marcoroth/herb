---
title: What's new in Herb v0.10
author:
  name: Marco Roth
date: 2026-08-18
layout: doc
sidebar: false
outline:
  level: [2, 2]
  label: In this post
head:
  - - meta
    - property: og:type
      content: article

  - - meta
    - property: og:title
      content: What's new in Herb v0.10

  - - meta
    - property: og:image
      content: /blog/whats-new-in-herb-v0-10/hero.png

  - - meta
    - property: og:image:width
      content: "1560"

  - - meta
    - property: og:image:height
      content: "864"

  - - meta
    - property: og:url
      content: /blog/whats-new-in-herb-v0-10

  - - meta
    - property: og:description
      content: Herb v0.10 lays the foundation for reactive rendering with a syntax tree diff engine, a hot-reloading dev server, Action View render graph analysis, a 243-helper registry, compile-time optimizations, and 25 new linter rules.

  - - meta
    - property: article:author
      content: Marco Roth

  - - meta
    - name: twitter:card
      content: summary_large_image
---

# What's new in Herb v0.10

_August 18, 2026_ • Marco Roth

![Herb v0.10 Announcement Cover Image](/blog/whats-new-in-herb-v0-10/hero.png)

We are excited to announce **Herb v0.10**!

If you're not familiar with Herb yet: **Herb** is the modern HTML+ERB toolchain. It's an ecosystem of powerful and seamless developer tools for HTML+ERB (`.html.erb`) templates. At its core is the **Herb Parser**, a fast, portable, and HTML-aware ERB parser written in C.

The toolchain includes a [linter](/projects/linter), [formatter](/projects/formatter), [language server](/projects/language-server), and [rendering engine](/projects/engine), with language bindings for Ruby, Node.js, Java, Rust, and the browser via WebAssembly. If you haven't used Herb before, we suggest reading the [Overview](/overview) page first.

The vision is to treat HTML+ERB as a first-class language with the same level of tooling support you'd expect from any modern programming language: parsing, linting, formatting, code intelligence, and error reporting, while also improving HTML rendering from Ruby and driving innovation in the Ruby and Rails view layers.

**Quick links:**

- [Herb v0.10.0 Changelog](https://github.com/marcoroth/herb/releases/tag/v0.10.0)
- [ReActionView v0.4.0 Changelog](https://github.com/marcoroth/reactionview/releases/tag/v0.4.0)
- [Documentation](/overview)

This release includes contributions from **22 contributors** across **376 commits**, with **17 people making their first contribution** to the project. We encourage you to get involved and help us improve Herb for the entire community. Feel free to check out the [open issues](https://github.com/marcoroth/herb/issues) or get in touch.

For the latest news about Herb, follow [Marco Roth](https://marcoroth.dev) on any of the socials.

> [!NOTE]
> This post covers everything since the [v0.9 release](/blog/whats-new-in-herb-v0-9), which means all of the v0.9.x patch releases as well as v0.10.0 through v0.10.3.
>
> It also doubles as the final report for the [2026 Gem Fellowship](https://gem.coop/updates/2026-fellowship/) grant that funded part of this work. If that's what you're here for, skip to [Gem Fellowship: Final Report](#gem-fellowship-final-report).


## What's New in Herb v0.10

Where v0.9 focused on stability and depth, v0.10 is about a single question: **what does an ERB engine need to understand before it can render reactively?**

![Herb v0.10 Feature Summary](/blog/whats-new-in-herb-v0-10/summary.png)

This release is the companion to [*HTML-Aware ERB: The Path to Reactive Rendering*](https://rubykaigi.org/2026/presentations/marcoroth.html), the talk I gave at **RubyKaigi 2026** in April. The recording is still to come, so for now this post covers the same ground.

Almost everything in this release exists because of that question. The render graph, the helper registry, the tag helper transformations, the diff engine, and the dev server are all steps toward it. The compile-time optimizations and the hot reloading you can use today are, honestly, side effects of the work.


## Herb v0.10 and ReActionView v0.4

Herb v0.10.0 shipped from the stage at RubyKaigi on April 22, at the end of the talk. The v0.10.x line has been hardening ever since, through three patch releases that brought ten more linter rules, a long run of formatter fixes, and a new corpus check that runs every pull request against 328 real applications.

What was missing was the other half. Herb itself is not tied to Rails, and everything in this post works today in any Ruby project. In a Rails app, though, the parser and the engine arrive through [ReActionView](https://reactionview.dev), which registers `Herb::Engine` as the template handler for `.html.erb` and `.html.herb`.

So this post lands together with [**ReActionView v0.4.0**](https://github.com/marcoroth/reactionview/releases/tag/v0.4.0), the first ReActionView release built on Herb v0.10. If you're on Rails, that's the version that brings everything described here into your app. It also adds Herb Dev Server and Herb Client support, so the hot reloading described below works from a Rails app.


## The Path to Reactive Rendering

Think of a spreadsheet. You change one cell, and every cell that depends on it updates. You never tell each cell to recalculate, because the spreadsheet maintains a dependency graph internally and simply updates what is affected.

That's what we want for views. You update `@post.title` on the server, and the specific DOM nodes that display it get patched. No Turbo Stream action, no target selectors, no manual wiring.

Every major ecosystem has solved some version of this. React diffs a virtual DOM. Svelte moves the analysis to compile time. Solid tracks dependencies fine-grained enough to bypass the component tree entirely. Phoenix LiveView, with José Valim's LiveEEx, does compile-time change tracking with slot-level updates and only sends the values that actually changed. Laravel Livewire re-renders components and morphs the DOM.

They all share one property: **the engine understands what it is rendering**, and it has a graph of dependencies. That graph is what makes fine-grained updates possible.

In Ruby we have never had that for the view layer, and the reason is straightforward. Erubi splits templates with a regular expression. Everything between `<%` and `%>` becomes Ruby, everything else becomes a string literal appended to a buffer. It has no idea that `@title` sits inside an `<h1>`, or that an `if` block wraps a `<p>` tag.

To be clear: that simplicity is a strength. Erubi is fast, stable, and has served Rails brilliantly. But it was designed for a world where templates only needed to produce strings, and reactivity needs something it was never designed to provide.

[`Herb::Engine`](/projects/engine) sits in exactly the same slot in the Action View pipeline and produces byte-identical compiled output. The difference is that it gets there through an AST instead of a regular expression. Same result, structural understanding.

The rest of this section walks through what the engine still needed to learn.


## Understanding the Render Graph

A page in Rails is assembled from many files: layout, view, partials, nested partials. When a piece of state changes, you need to know which templates are affected, and that means knowing the full render tree.

Action View resolves `render` calls at runtime, so it doesn't know the tree until the page is actually rendered. John Hawthorn's [`actionview_precompiler`](https://github.com/jhawthorn/actionview_precompiler) proved static analysis here is possible and valuable, but it has to work in two stages: compile ERB to Ruby with Erubi first, then re-parse the compiled Ruby with Prism to find the `render` call nodes. It reconstructs information that Erubi threw away.

Herb doesn't need two stages. A new `render_nodes` parser option ([#1385](https://github.com/marcoroth/herb/pull/1385)) turns `render` calls into first-class `ERBRenderNode` nodes with every Action View keyword argument extracted:

```erb
<%= render partial: "posts/card", locals: { title: @title, body: "Hello" } %>
```

```js
@ DocumentNode (location: (1:0)-(1:71))
└── children: (1 item)
    └── @ ERBRenderNode (location: (1:0)-(1:71)) // [!code focus]
        ├── tag_opening: "<%=" (location: (1:0)-(1:3))
        ├── content: " render partial: \"posts/card\", locals: { title: @title, body: \"Hello\" } "
        ├── tag_closing: "%>" (location: (1:69)-(1:71))
        ├── partial: "posts/card" (location: (1:20)-(1:32)) // [!code focus]
        ├── collection: ∅
        ├── object: ∅
        ├── as: ∅
        └── locals: (2 items) // [!code focus]
            ├── @ RubyRenderLocalNode (location: (1:38)-(1:51))
            │   ├── name: "title" (location: (1:38)-(1:44))
            │   └── value:
            │       └── @ RubyLiteralNode (location: (1:45)-(1:51))
            │           └── content: "@title"
            │
            └── @ RubyRenderLocalNode (location: (1:53)-(1:66))
                ├── name: "body" (location: (1:53)-(1:58))
                └── value:
                    └── @ RubyLiteralNode (location: (1:59)-(1:66))
                        └── content: "\"Hello\""
```

Alongside `ERBRenderNode`, the release adds `RubyRenderLocalNode` and `RubyRenderKeywordsNode`, plus seven dedicated errors for render calls that can't be valid: `RenderAmbiguousLocalsError`, `RenderMissingLocalsError`, `RenderNoArgumentsError`, `RenderConflictingPartialError`, `RenderInvalidAsOptionError`, `RenderObjectAndCollectionError`, and `RenderLayoutWithoutBlockError`.

### The Render Analyzer

On top of those nodes, [#1663](https://github.com/marcoroth/herb/pull/1663) adds `Herb::ActionView::RenderAnalyzer`, which traces render calls across a whole project to build the dependency graph:

```ruby
analyzer = Herb::ActionView::RenderAnalyzer.new("/path/to/project")

result = analyzer.analyze
result.unresolved
result.unused
result.issues?

analyzer.fully_resolvable?("app/views/posts/show.html.erb") # => true/false
```

It's available from the CLI through a new `actionview` command:

```bash
bundle exec herb actionview graph app/views/profiles/show.html.erb
```

![Render graph for a profile show page, listing every partial it pulls in](/blog/whats-new-in-herb-v0-10/actionview-graph-show.png)

`graph` shows the full render tree for a file or project, and it works in both directions: which partials a page pulls in, and which routes and pages a given partial is reachable from.

![Reverse render graph for a partial, showing every page that reaches it](/blog/whats-new-in-herb-v0-10/actionview-graph-partial.png)

`check` reports render calls that can't be resolved statically (because they use metaprogramming or dynamic paths) along with partials that have no call site anywhere, which usually means they can be deleted. It exits non-zero when it finds issues, so it works as a CI check.

![herb actionview check reporting unresolved and unused partials across a project](/blog/whats-new-in-herb-v0-10/actionview-check.png)

`fully_resolvable?` is the interesting one for what comes next. It walks the entire render tree and confirms there are no dynamic or unresolved gaps, which is exactly the guarantee compile-time partial inlining needs.


## Knowing What the References Are

Once you can see the render graph, the next question is what the expressions inside those templates actually refer to:

```erb
<%= link_to user.name, user_path(user) %>
```

Is `user` a local, an instance variable, or a method? Is `user_path` a route helper? Is `link_to` an Action View helper or something defined in `app/helpers`? Prism answers a lot of this by analysing the Ruby inside each ERB tag, but the built-in Rails helpers needed something else.

### The Action View Helper Registry

[#1611](https://github.com/marcoroth/herb/pull/1611) introduces a single source of truth for Rails view helpers. **243 helpers** are defined as YAML files under `config/action_view_helpers/`, organized by gem and module:

```
config/action_view_helpers/
  actionview/           url_helper, asset_tag_helper, form_helper, text_helper, ...
  actionpack/           polymorphic_routes, ...
  turbo-rails/
  actioncable/
  actiontext/
  importmap-rails/
```

Those YAML files are code-generated into all five bindings: C (`helper_registry.h/c` plus generated detect and extract handlers), TypeScript, Ruby, Java, and Rust. Adding a helper used to mean touching three or more hand-written files across multiple languages. Now it means adding one YAML file.

The registry immediately paid for itself in the language server: hovering any registered helper now shows its signature, description, and documentation link, not just the handful of helpers the parser can transform. Nested helpers work too, so hovering `dom_id` inside `<%= turbo_frame_tag dom_id(user) do %>` shows `dom_id`'s documentation.

<video src="/blog/whats-new-in-herb-v0-10/helper-registry-hover.mp4" controls autoplay loop muted>
  Hovering Action View helpers in the editor to see signatures and documentation from the registry
</video>

### Strict Locals as a First-Class Node

Partials that declare strict locals are declaring their inputs, which is exactly the information a dependency graph wants. [#1424](https://github.com/marcoroth/herb/pull/1424) adds a `strict_locals` parser option and an `ERBStrictLocalsNode`:

```erb
<%# locals: (user:, theme: "light", **attrs) %>

<%= user %>
<%= theme %>
```

```js
@ ERBStrictLocalsNode (location: (1:0)-(1:47))
├── tag_opening: "<%#" (location: (1:0)-(1:3))
├── content: " locals: (user:, theme: \"light\", **attrs) "
├── tag_closing: "%>" (location: (1:45)-(1:47))
└── locals: (3 items)
    ├── @ RubyStrictLocalNode
    │   ├── name: "user"
    │   ├── default_value: ∅
    │   ├── required: true
    │   └── double_splat: false
    │
    ├── @ RubyStrictLocalNode
    │   ├── name: "theme"
    │   ├── default_value: @ RubyLiteralNode → "\"light\""
    │   ├── required: false
    │   └── double_splat: false
    │
    └── @ RubyStrictLocalNode
        ├── name: "attrs"
        ├── required: false
        └── double_splat: true
```

Five new errors cover the ways a strict locals declaration can be malformed: `StrictLocalsPositionalArgumentError`, `StrictLocalsBlockArgumentError`, `StrictLocalsSplatArgumentError`, `StrictLocalsMissingParenthesisError`, and `StrictLocalsDuplicateDeclarationError`. The existing strict locals linter rules were reworked onto the new node in [#1430](https://github.com/marcoroth/herb/pull/1430), and two new rules joined them: [`actionview-strict-locals-first-line`](/linter/rules/actionview-strict-locals-first-line.md) and [`actionview-strict-locals-partial-only`](/linter/rules/actionview-strict-locals-partial-only.md).


## Understanding Tag Helpers

This is the challenge that matters most for fine-grained updates. Consider:

```erb
<%= tag.div id: dom_id(post), class: "card" do %>
  <%= link_to post.title, post_path(post) %>
<% end %>
```

If `post` changes, what needs to re-render? Every ERB output tag has a simple contract: state goes in, a string comes out. That contract is what makes ERB well suited to reactivity in the first place, but it also means that when `post` appears inside a `do ... end` block, the unit of change is the entire block, including all of its children. You end up re-rendering the whole template.

Herb can now transform these helpers into their HTML equivalent in the syntax tree:

```erb
<div id="<%= dom_id(post) %>" class="card">
  <a href="<%= post_path(post) %>"><%= post.title %></a>
</div>
```

Suddenly `post` isn't "somewhere in this block". It's the `id` attribute, the `href` attribute, and the text content of the `<a>` tag. That's a granularity you can act on.

v0.10 significantly expanded which helpers the parser understands and how faithfully it reproduces what Rails would emit:

- `image_tag` ([#1437](https://github.com/marcoroth/herb/pull/1437)), `javascript_tag` and `javascript_include_tag` ([#1374](https://github.com/marcoroth/herb/pull/1374)), and `tag.attributes` ([#1461](https://github.com/marcoroth/herb/pull/1461))
- Helpers inside control flow blocks ([#1447](https://github.com/marcoroth/herb/pull/1447)) and postfix conditionals and ternaries via a new `transform_conditionals` option ([#1560](https://github.com/marcoroth/herb/pull/1560), [#1594](https://github.com/marcoroth/herb/pull/1594))
- Keyword argument shorthand ([#1433](https://github.com/marcoroth/herb/pull/1433)), attribute splats ([#1499](https://github.com/marcoroth/herb/pull/1499)), and dynamic content ([#1491](https://github.com/marcoroth/herb/pull/1491))
- Rails-matching attribute ordering ([#1576](https://github.com/marcoroth/herb/pull/1576)) and consistent attribute quoting ([#1577](https://github.com/marcoroth/herb/pull/1577))
- `javascript_tag` content is now treated as foreign content and wrapped in a `CDATANode` ([#1434](https://github.com/marcoroth/herb/pull/1434), [#1574](https://github.com/marcoroth/herb/pull/1574)), and `nonce: true` resolves properly ([#1452](https://github.com/marcoroth/herb/pull/1452))

As a side effect, the language server can show you the same transformation. Hover a tag helper and the Hover Provider renders the equivalent HTML+ERB ([#1460](https://github.com/marcoroth/herb/pull/1460)), which is genuinely useful when you're going back and forth between helper syntax and markup.

<video src="/blog/whats-new-in-herb-v0-10/hover-shallow-rewrite.mp4" controls autoplay loop muted>
  Hovering a tag helper to see the equivalent HTML+ERB it produces
</video>


## Computing the Changes

Knowing the structure is one thing. Knowing what changed between two versions of that structure is another. [#1518](https://github.com/marcoroth/herb/pull/1518) implements a **syntax tree diff engine** in C, so it's available across every binding.

The API is deliberately small:

```ruby
result = Herb.diff(old_source, new_source)

result.identical?  # => false
result.operations  # => [#<Herb::DiffOperation type=attribute_value_changed path=[0, 0]>, ...]
```

```bash
bundle exec herb diff old.html.erb new.html.erb
```

Under the hood it runs in several stages:

1. **Merkle hashing.** A bottom-up pass computes [FNV-1a](http://www.isthe.com/chongo/tech/comp/fnv/) hashes for every node, incorporating all children. Identical subtrees share a hash and are skipped in constant time. Same concept as [Merkle trees](https://en.wikipedia.org/wiki/Merkle_tree) in Git.
2. **LCS-based children diffing.** Child arrays are compared with the Longest Common Subsequence algorithm to find the minimal edit sequence, the same algorithm behind `git diff`, applied to AST node arrays instead of text lines.
3. **Move detection.** Unmatched remove and insert pairs are checked for matching identity (same tag name and attributes, order-independent via XOR of attribute hashes) and collapsed into a single move.
4. **Wrap and unwrap detection.** Catches a node being wrapped in a new parent, such as `<div></div>` becoming `<% if admin? %><div></div><% end %>`, and the reverse.

The result is these typed operations:

```
node_inserted
node_removed
node_replaced
node_moved
node_wrapped
node_unwrapped
text_changed
erb_content_changed
attribute_added
attribute_removed
attribute_value_changed
tag_name_changed
```

<video src="/blog/whats-new-in-herb-v0-10/diff-engine.mp4" controls autoplay loop muted>
  The diff engine reporting typed operations as a template changes
</video>

Each operation carries a node path, which maps directly to a position in the document. That path is the coordinate system everything downstream uses.


## Delivering the Updates

With a diff engine that speaks in node paths, hot reloading becomes tractable. [#1662](https://github.com/marcoroth/herb/pull/1662) introduces the [Herb Dev Server](/projects/dev-server) and a companion browser package that applies the patches it sends.

```bash
herb dev [directory] [--port 8592]
```

```
 🌿 Herb Dev Server

  Herb:      0.10.3
  Project:   /path/to/project
  Config:    .herb.yml
  Files:     453 templates indexed
  WebSocket: ws://localhost:8592

  Ready! Watching for changes...

  Recent changes:

    20:13:40 ✓ patch  app/views/posts/show.html.erb (1 operation) [1 client]
                      #1 text changed [4, 8]
    20:13:45 ↻ reload app/views/posts/index.html.erb (2 operations) [1 client]
                      #1 node inserted [0, 3]
                      #2 text changed [0, 4]
```

The server watches your templates, parses each change, diffs it against the cached previous AST, and pushes the result over a WebSocket. Text and attribute changes are patched in place. Structural changes fall back to a reload. The CLI shows you which one happened and why.

The client applies patches with `textContent` and `setAttribute`, never `innerHTML`. It connects automatically via ReActionView, which means it composes with the browser dev tools that already ship with the engine.

<video src="/blog/whats-new-in-herb-v0-10/dev-server-demo.mp4" controls autoplay loop muted>
  Editing a template and seeing the browser update in place without a reload
</video>

Add it to your `Procfile.dev` and you get incremental updates while you edit, including across partials, so a partial that appears three times on a page updates in all three places at once.

<video src="/blog/whats-new-in-herb-v0-10/dev-server-partials.mp4" controls autoplay loop muted>
  Updating a partial and seeing every instance of it on the page update at once
</video>

Parse errors surface immediately and clear themselves when you fix them.

Wiring it into a Rails application is what [ReActionView v0.4.0](https://github.com/marcoroth/reactionview/releases/tag/v0.4.0) adds. It serves the client alongside the existing dev tools and takes a `dev_server_port` setting, so running `herb dev` next to your server is all that's left to do.


> [!WARNING]
> The dev server is experimental and may not work correctly in all cases. We currently support a limited set of in-place patches, and that set will grow.

What makes this different from Vite or webpack-dev-server is where the intelligence lives. The AST diffing happens in the template engine, not in a client-side bundler shimmed on top of a build pipeline.


## Where That Leaves Reactivity

Being straightforward about it: **production reactivity does not ship in v0.10**, and nothing in this release lets you push state-driven DOM updates to a browser today.

What ships is the foundation. Herb can now trace the render graph across a project and resolve what the references in a template point to. It can decompose Action View tag helpers into the HTML they produce, diff two versions of a template down to the minimal set of changes, and deliver the resulting patches over a WebSocket.

Two pieces of the path were built alongside this release and demoed in the talk, but missed the v0.10 cut. Both have since landed on `main` and will ship in v0.11: state dependency tracing with the reverse node index ([#1667](https://github.com/marcoroth/herb/pull/1667)), which answers "when `@post` changes, which nodes are affected?", and compile-time inlining of static partials ([#1666](https://github.com/marcoroth/herb/pull/1666)), which closed [issue #654](https://github.com/marcoroth/herb/issues/654).

After that, the remaining work is the Rails integration layer, which is the [ReActionView](https://reactionview.dev) roadmap. That layer has since started coming together too.

## Compile-Time Optimizations

Here's the part that wasn't the goal. Once the engine knows what HTML a helper produces, it can stop producing it at runtime.

[#1613](https://github.com/marcoroth/herb/pull/1613) adds an `optimize` option to `Herb::Engine`:

```ruby
Herb::Engine.new(source, optimize: true)
```

When enabled, supported helpers (`tag.*`, `content_tag`, `link_to`, `image_tag`, `javascript_tag`, `javascript_include_tag`, `turbo_frame_tag`) are transformed into their HTML equivalents at compile time. A helper call that used to compile to this:

```ruby
@output_buffer.safe_expr_append=(tag.input(type: "text", name: "query",
  autofocus: true, autocomplete: "off",
  placeholder: "Search talks, speakers, events...",
  class: "w-full p-3 outline-none text-lg",
  data: { action: "spotlight-search#search" }))
```

now compiles to this:

```ruby
@output_buffer.safe_append='<input type="text" name="query" autofocus
  autocomplete="off" placeholder="Search talks, speakers, events..."
  class="w-full p-3 outline-none text-lg"
  data-action="spotlight-search#search">';
```

No runtime method dispatch, no hash construction, no attribute escaping. Early benchmarks show **3x to 22x faster render times** on realistic pages, and up to **150x** on templates where every helper argument is static.

The honest trade-off: Herb's parser is currently 10x to 90x slower than Erubi at compile time, so the optimization needs to be amortized over roughly 15 to 100 renders depending on the template. Since Action View compiles templates lazily on first render and caches the result, this is usually won back quickly, and it could be done ahead of time instead. The other trade-off is that you can no longer monkey-patch the optimized helpers at runtime.

![Benchmark output comparing runtime tag helpers against compile-time optimized output](/blog/whats-new-in-herb-v0-10/compile-time-optimization.png)

> [!WARNING]
> Compile-time optimizations are experimental. Output may differ from standard Action View rendering.

Because "may differ" is not a satisfying thing to tell people, [#1660](https://github.com/marcoroth/herb/pull/1660) adds verification. When `verify_optimizations` is enabled, each template is compiled twice on first render, once optimized and once not, and the outputs are compared. A mismatch injects a marker into the page, the dev tools show a warning badge next to the floating menu listing the affected templates, and the full diff goes to the Rails log.

Both stay off by default, and that is where they should stay until the compile-time cost above comes down.


## Linter

The linter grew from **73 rules to 98**, with 18 landing in v0.10.0 and 7 more across the patch releases.

### New Rules

**Action View**

| Rule | What it catches |
| --- | --- |
| [`actionview-no-silent-render`](/linter/rules/actionview-no-silent-render.md) | `render` called without outputting the result |
| [`actionview-no-void-element-content`](/linter/rules/actionview-no-void-element-content.md) | Content arguments passed to void Action View elements |
| [`actionview-no-unnecessary-tag-attributes`](/linter/rules/actionview-no-unnecessary-tag-attributes.md) | Unnecessary `tag.attributes` usage (with autofix) |
| [`actionview-strict-locals-first-line`](/linter/rules/actionview-strict-locals-first-line.md) | Strict locals not on the first line with a blank line after |
| [`actionview-strict-locals-partial-only`](/linter/rules/actionview-strict-locals-partial-only.md) | Strict locals declared outside a partial |

**ERB**

| Rule | What it catches |
| --- | --- |
| [`erb-no-silent-statement`](/linter/rules/erb-no-silent-statement.md) | Silent ERB statements that should output |
| [`erb-no-empty-control-flow`](/linter/rules/erb-no-empty-control-flow.md) | Empty control flow blocks |
| [`erb-no-unused-literals`](/linter/rules/erb-no-unused-literals.md) | Ruby literals in ERB that produce no output |
| [`erb-no-unused-expressions`](/linter/rules/erb-no-unused-expressions.md) | Unused expressions in silent ERB tags |
| [`erb-no-debug-output`](/linter/rules/erb-no-debug-output.md) | `debug`, `pp`, and friends left in templates |
| [`erb-prefer-direct-output`](/linter/rules/erb-prefer-direct-output.md) | String interpolation where direct output would do |
| [`erb-no-commented-out-output-tags`](/linter/rules/erb-no-commented-out-output-tags.md) | Commented-out output tags |

**HTML**

| Rule | What it catches |
| --- | --- |
| [`html-no-unknown-tag`](/linter/rules/html-no-unknown-tag.md) | Tags that aren't valid HTML, SVG, or MathML |
| [`html-no-unescaped-entities`](/linter/rules/html-no-unescaped-entities.md) | Characters that should be escaped |
| [`html-require-script-nonce`](/linter/rules/html-require-script-nonce.md) | `script` tags and helpers missing a nonce |

**Accessibility**

Nine new a11y rules landed across v0.10: [`a11y-no-autofocus-attribute`](/linter/rules/a11y-no-autofocus-attribute.md), [`a11y-no-aria-unsupported-elements`](/linter/rules/a11y-no-aria-unsupported-elements.md), [`a11y-no-accesskey-attribute`](/linter/rules/a11y-no-accesskey-attribute.md), [`a11y-svg-has-accessible-text`](/linter/rules/a11y-svg-has-accessible-text.md), [`a11y-nested-interactive-elements`](/linter/rules/a11y-nested-interactive-elements.md), [`a11y-no-aria-label-misuse`](/linter/rules/a11y-no-aria-label-misuse.md), [`a11y-avoid-generic-link-text`](/linter/rules/a11y-avoid-generic-link-text.md), [`a11y-no-redundant-image-alt`](/linter/rules/a11y-no-redundant-image-alt.md), and [`a11y-disabled-attribute`](/linter/rules/a11y-disabled-attribute.md).

**Formatting**

[`source-indentation`](/linter/rules/source-indentation.md) checks indentation and picks up `indentWidth` from your formatter configuration, so it needs no setting of its own.

### Action View Helper Aware Rules

A rule that only understands `<img>` misses `image_tag`. Existing rules were taught to see through helpers, including `html-img-require-alt`, `html-no-self-closing`, `html-no-duplicate-attributes`, `html-no-duplicate-ids`, `erb-no-javascript-tag-helper`, and `no-output-in-attribute-position`.

### Version Gated Rules

Upgrading Herb should never surprise you with new offenses. Each rule now declares the version it was introduced in ([#1453](https://github.com/marcoroth/herb/pull/1453)):

```ts
static introducedIn = this.version("0.10.0")
```

If your `.herb.yml` pins an older version, rules newer than that are skipped automatically. You can still enable any rule explicitly, regardless of version.

With no `.herb.yml` at all, every rule runs:

![Linter output with no config file, running every rule](/blog/whats-new-in-herb-v0-10/version-gated-no-config.png)

With a `.herb.yml` pinning an older version, the newer rules are listed as skipped instead of failing your build:

![Linter output with a pinned older version, showing newer rules skipped](/blog/whats-new-in-herb-v0-10/version-gated-older-version.png)

And `--upgrade` walks you through adopting them deliberately:

![The --upgrade flow adopting newly available rules](/blog/whats-new-in-herb-v0-10/version-gated-upgrade.png)

### Editor and CLI Severities

Some rules make sense as build failures but are noisy in an editor. Severity now accepts a per-context object ([#1532](https://github.com/marcoroth/herb/pull/1532)):

```yaml
severity:
  cli: error
  editor: info
```

The linter defaults to `cli` mode, and the language server sets `editor` mode on its own instance.

### Linter CLI

- `--disable-failing` lints the project and writes a disable entry into `.herb.yml` for every rule with an offense ([#1485](https://github.com/marcoroth/herb/pull/1485)), which makes adopting Herb on an existing codebase a single command
- `--upgrade` now only disables rules that actually have offenses ([#1484](https://github.com/marcoroth/herb/pull/1484))
- `--only` runs a single rule and `--all-rules` runs every rule regardless of configuration ([#1908](https://github.com/marcoroth/herb/pull/1908), [#1919](https://github.com/marcoroth/herb/pull/1919))
- A rule summary grouped by status ([#1486](https://github.com/marcoroth/herb/pull/1486)), a clearer fixable offenses label, and a progress message when linting many files

<video src="/blog/whats-new-in-herb-v0-10/linter-cli-upgrade.mp4" controls autoplay loop muted>
  Running the linter --upgrade flow on a project
</video>

![Linter CLI rule summary grouped by status](/blog/whats-new-in-herb-v0-10/linter-cli-rule-summary.png)


## Language Service

[`@herb-tools/language-service`](/projects/language-service) ([#1446](https://github.com/marcoroth/herb/pull/1446)) is a new package that provides an HTML+ERB language service with an API compatible with [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice), which makes it a drop-in replacement:

```diff
- import { getLanguageService } from 'vscode-html-languageservice'
+ import { Herb } from '@herb-tools/node-wasm'
+ import { getLanguageService } from '@herb-tools/language-service'

+ await Herb.load()

  const service = getLanguageService({
+   herb: Herb,
    customDataProviders: [myDataProvider],
  })
```

Because `parseHTMLDocument` uses the Herb parser, `<%= tag.div data: { controller: "scroll" } %>` is understood as a `<div>` with a `data-controller` attribute, so completions, diagnostics, and navigation all work inside tag helpers. Completions adapt to Ruby hash context, so inside a `data: {}` hash it suggests `action`, matching the Ruby you are actually writing. Every node tracks `attributeSourceRanges` so diagnostics point at the right place in the original ERB, even for attributes that were synthesized from Ruby keyword arguments.

It was built with [Stimulus LSP](https://github.com/marcoroth/stimulus-lsp) as the first consumer in mind, and that has already shipped: [Stimulus LSP v1.1.0](https://github.com/marcoroth/stimulus-lsp/releases/tag/v1.1.0) migrated off `vscode-html-languageservice` onto `@herb-tools/language-service`. Controller completions, diagnostics, and go-to-definition now work inside `<%= tag.div data: { controller: "scroll" } %>` the same way they always did inside a plain `data-controller` attribute.


## Configuration

Two new top-level options in `.herb.yml` ([#1658](https://github.com/marcoroth/herb/pull/1658)):

```yaml
framework: actionview      # ruby | actionview | hanami | sinatra (default: ruby)
template_engine: herb      # erubi | erb | herb (default: erubi)
```

These tell Herb what environment it's running in. Valid values are defined once in `config/options.yml` and code-generated into every binding. They lay the groundwork for framework-aware linter rules, framework-aware compile-time optimizations (knowing the framework determines which helpers are available to optimize), and surfacing template engine incompatibilities across the toolchain.

A few smaller things landed alongside them. `.herb.yml` now takes precedence over soft project indicators when locating the project root ([#1602](https://github.com/marcoroth/herb/pull/1602)), `Herb::Configuration#user_config` is public ([#1661](https://github.com/marcoroth/herb/pull/1661)), rule-level patterns match absolute paths correctly ([#1645](https://github.com/marcoroth/herb/pull/1645)), and new rules are enabled without needing a `version` key ([#1544](https://github.com/marcoroth/herb/pull/1544)). The Rust `herb-config` crate gained validation, merging, and mutation ([#1920](https://github.com/marcoroth/herb/pull/1920)).


## Parser Improvements

Beyond the Action View work, the parser gained several capabilities.

### Dot Notation Component Tags

A new `dot_notation_tags` option ([#1436](https://github.com/marcoroth/herb/pull/1436)) parses compound component tags as single elements, inspired by [`Phoenix.Component`](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html) and JSX:

```
<Dialog.wrapper id="demo" title="Confirm">
  <Dialog.body>Are you sure?</Dialog.body>

  <Dialog.footer>
    <Dialog.cancel />
    <Dialog.confirm autofocus />
  </Dialog.footer>
</Dialog.wrapper>
```

The first segment has to start with an uppercase letter, and a `DotNotationCasingError` is reported when it doesn't.

To be clear about what this is and isn't: it is a parser option and nothing more. The parser will accept the syntax and give you a well-formed tree for it, but there is no mechanism attached. Nothing resolves `Dialog.wrapper` to a component, nothing renders it, and the engine has no notion of what it should produce. It exists so that projects experimenting with component syntaxes have something that can parse them, and so we can find out whether this shape is worth building on at all.

### Other Parser Work

- `rescue`, `else`, and `ensure` are now allowed on `ERBBlockNode` ([#1490](https://github.com/marcoroth/herb/pull/1490))
- `RubyParameterNode` represents block arguments ([#1585](https://github.com/marcoroth/herb/pull/1585))
- Escaped `<%%=` and `<%%` tags can be analyzed ([#1562](https://github.com/marcoroth/herb/pull/1562)) and are no longer treated as executable Ruby ([#1917](https://github.com/marcoroth/herb/pull/1917))
- A `VoidElementContentError` for content passed to void elements ([#1454](https://github.com/marcoroth/herb/pull/1454))
- Inline `in` expressions are allowed outside `case` statements ([#1821](https://github.com/marcoroth/herb/pull/1821))
- Fixed an infinite loop when parsing unclosed ERB tags ([#1482](https://github.com/marcoroth/herb/pull/1482)) and parsing of angle brackets and quotes inside attribute values ([#1509](https://github.com/marcoroth/herb/pull/1509))
- `timeout` and `max_errors` parser options for bounding work on pathological input ([#1795](https://github.com/marcoroth/herb/pull/1795), [#1796](https://github.com/marcoroth/herb/pull/1796))

The error catalog grew from 23 to 38 error types, and the AST gained five node types: `ERBRenderNode`, `RubyRenderLocalNode`, `RubyRenderKeywordsNode`, `ERBStrictLocalsNode`, and `RubyParameterNode`.


## Engine Improvements

- `parser_options` passthrough and engine configuration support ([#1657](https://github.com/marcoroth/herb/pull/1657))
- A dedicated `GeneratorTemplateError` ([#1558](https://github.com/marcoroth/herb/pull/1558))
- `add_expression_block` and context-aware expressions delegate to overridable methods for Erubi compatibility ([#1417](https://github.com/marcoroth/herb/pull/1417), [#1421](https://github.com/marcoroth/herb/pull/1421))
- A run of whitespace and trim fixes: whitespace between consecutive end tags after expression blocks, `-%>` followed by an indented control tag, leading whitespace before inline control tags, right-trim on expression block opening tags ([#1492](https://github.com/marcoroth/herb/pull/1492), [#1493](https://github.com/marcoroth/herb/pull/1493), [#1495](https://github.com/marcoroth/herb/pull/1495), [#1553](https://github.com/marcoroth/herb/pull/1553), [#1554](https://github.com/marcoroth/herb/pull/1554))
- `CDATANode` compilation ([#1575](https://github.com/marcoroth/herb/pull/1575)), `tag.attributes` allowed in the `SecurityValidator` ([#1483](https://github.com/marcoroth/herb/pull/1483)), and a `NameError` fix in `:overlay` mode for parser errors ([#1882](https://github.com/marcoroth/herb/pull/1882))
- A new `enforce_actionview_erubi_equality` test helper ([#1504](https://github.com/marcoroth/herb/pull/1504)) that verifies Herb's output matches Action View plus Erubi exactly


## Formatter Improvements

The formatter saw a long run of correctness fixes, most of them in the patch releases. It now preserves whitespace at glued content boundaries and around the punctuation at inline element edges, keeps ERB inline when it sits in attribute position, and holds on to content inside `script` and `style` ERB blocks. It also leaves `herb:disable` comments where you put them, preserves `<%#=` in commented-out output tags, formats ERB multiline comments better, and no longer flips `<br>` tags between glued and split forms.


## Playground

Syntax tree nodes can be collapsed and expanded ([#1450](https://github.com/marcoroth/herb/pull/1450)):

<video src="/blog/whats-new-in-herb-v0-10/playground-collapse-nodes.mp4" controls autoplay loop muted>
  Collapsing and expanding nodes in the Playground syntax tree
</video>

A new Action View to HTML rewriter tab ([#1457](https://github.com/marcoroth/herb/pull/1457)) shows the transformation described above:

![Playground tab rewriting Action View helpers into their HTML equivalent](/blog/whats-new-in-herb-v0-10/playground-actionview-rewriter.png)

And an "Autofix Unsafe" button ([#1516](https://github.com/marcoroth/herb/pull/1516)) applies the corrections that are marked unsafe:

<video src="/blog/whats-new-in-herb-v0-10/playground-autofix-unsafe.mp4" controls autoplay loop muted>
  Applying unsafe autofixes from the Playground
</video>


## Ruby and Tooling

- **Ruby 3.2 is now the minimum supported version** ([#1654](https://github.com/marcoroth/herb/pull/1654))
- TypeScript 6.0 across the JavaScript packages ([#1472](https://github.com/marcoroth/herb/pull/1472))
- `Visitor#visit_node` and `#visit_erb_node` in the Ruby bindings ([#1530](https://github.com/marcoroth/herb/pull/1530))
- RBS signatures are now validated on CI ([#1712](https://github.com/marcoroth/herb/pull/1712)) with a `sig/manifest.yaml` declaring stdlib dependencies
- A new Corpus workflow on CI ([#1881](https://github.com/marcoroth/herb/pull/1881)) that compares parser and linter behavior against a large body of real templates on every pull request
- A CI Integrations guide with per-provider pages ([#1684](https://github.com/marcoroth/herb/pull/1684))


## Herb at GitHub

One thing worth sharing: **GitHub has adopted Herb in their monolith**, where it now checks roughly 10,000 view files, around half a million lines of ERB, on every push.

[Joel Hawksley](https://github.com/joelhawksley) wrote up the whole rollout in [*Adopting Herb at GitHub*](https://hawksley.org/2026/05/06/adopting-herb-at-github.html), and it's worth reading in full. The linter surfaced 2,768 files needing fixes on the first run, including missing and swapped closing tags and invalid Ruby that had been sitting there unnoticed by the existing tooling.

Joel is also clear about what still blocks using `Herb::Engine` in production there: Herb compiles templates 7x to 15x slower than Erubi, which pushed their boot time from two minutes to three. That is the same trade-off described in the compile-time optimizations section above. Making compilation fast enough, or finding a way to compile ahead of time, is worth looking into now.

A codebase of that size and age adopting Herb is the strongest signal yet that the project solves a real problem, and it directly motivated the Corpus workflow mentioned above.


## Herb in Tilt

The other adoption news is that [Tilt 2.9.0](https://github.com/jeremyevans/tilt/discussions/31) ships a Herb template, registered for both `.herb` and `.html.erb`. Tilt is the template interface behind Sinatra, Roda, and much of the Ruby web ecosystem outside Rails, so Herb is now available there without any wiring of your own.

Tilt is maintained by [Jeremy Evans](https://github.com/jeremyevans), who also wrote Erubi, the engine `Herb::Engine` is built to be API-compatible with.

This is also the clearest illustration of the point made at the top: Herb is a Ruby library, not a Rails one. ReActionView is how Herb reaches Rails, and Tilt is now how Herb reaches everything else.


## Gem Fellowship: Final Report

Herb was selected as one of the [2026 Gem Fellows](https://gem.coop/updates/2026-fellowship/) by [gem.coop](https://gem.coop) and [Contributed Systems](https://contribsys.com), the company behind Sidekiq Pro and Sidekiq Enterprise. The grant went toward part of the work in this release, so this section is the report on it.

This is what the proposal committed to, as published:

> Herb is an HTML-aware ERB parser and tooling foundation that treats HTML+ERB as a structured language rather than plain text. It provides a lossless syntax tree that enables reliable formatters, linters, language servers, and more advanced rendering and developer tooling in the Ruby ecosystem.

> This grant will be used to stabilize Herb towards a 1.0-ready tooling and language foundation for Ruby, with a focus on backwards compatibility. It will also lay the groundwork for exploring reactivity support in the rendering engine.

Two commitments, then: stabilization with a focus on backwards compatibility, and groundwork for exploring reactivity. Here is where each stands.

### 1. Stabilization and Backwards Compatibility

Backwards compatibility here means compatibility with what people already run. Three things have to hold for Herb to earn a place in the pipeline. Dropping `Herb::Engine` in where `Erubi::Engine` was has to change nothing you can observe. The parser has to cope with whatever real templates throw at it. And the tree it produces has to be right. The grant went into all three.

**Erubi compatibility, enforced by the test suite.** The engine now has to prove it matches on every test: `enforce_actionview_erubi_equality` ([#1504](https://github.com/marcoroth/herb/pull/1504)) compiles a template through both Herb and Action View plus Erubi and requires the output to be identical. That turned compatibility from a claim into a build failure. It promptly found five whitespace and trim divergences that had been sitting in the engine, around consecutive end tags, `-%>` before an indented control tag, inline control tags, and expression block openings ([#1492](https://github.com/marcoroth/herb/pull/1492), [#1493](https://github.com/marcoroth/herb/pull/1493), [#1495](https://github.com/marcoroth/herb/pull/1495), [#1553](https://github.com/marcoroth/herb/pull/1553), [#1554](https://github.com/marcoroth/herb/pull/1554)). Every one of them was a byte of difference in the generated output, which is exactly what makes a swap stop being seamless. `add_expression_block` and the context-aware expression methods were also made properly overridable so Erubi subclasses keep working ([#1417](https://github.com/marcoroth/herb/pull/1417), [#1421](https://github.com/marcoroth/herb/pull/1421)).

The same principle covers the optimized path. When compile-time optimizations are enabled, templates are compiled twice and compared, and divergence surfaces in the dev tools and the log instead of shipping quietly ([#1660](https://github.com/marcoroth/herb/pull/1660)).

**A parser that handles what is actually out there.** The Corpus workflow ([#1881](https://github.com/marcoroth/herb/pull/1881), [#1906](https://github.com/marcoroth/herb/pull/1906), [#1910](https://github.com/marcoroth/herb/pull/1910)) parses and lints **328 real applications, 41,661 ERB templates** on every pull request. It compares the results against both the last release and the base branch, fails on regressions, and posts the comparison as a comment. It is the difference between believing the parser handles everything and knowing which templates it doesn't.

Between them, the corpus and GitHub's adoption turned up plenty to fix. An infinite loop on unclosed ERB tags ([#1482](https://github.com/marcoroth/herb/pull/1482)), angle brackets and quotes inside attribute values ([#1509](https://github.com/marcoroth/herb/pull/1509)), `rescue`/`else`/`ensure` on block nodes ([#1490](https://github.com/marcoroth/herb/pull/1490)), inline `in` outside a `case` ([#1821](https://github.com/marcoroth/herb/pull/1821)), `yield` inside a block ([#1893](https://github.com/marcoroth/herb/pull/1893)), escaped `<%%` tags treated as executable Ruby ([#1917](https://github.com/marcoroth/herb/pull/1917)), and Prism byte offsets on non-ASCII source ([#1866](https://github.com/marcoroth/herb/pull/1866)). Roughly 35 fixes in total. Pathological input is now bounded, through `timeout` and `max_errors` ([#1795](https://github.com/marcoroth/herb/pull/1795), [#1796](https://github.com/marcoroth/herb/pull/1796)).

**An AST you can trust.** The linter, the formatter, the language server and the engine are all only as correct as the tree underneath them. A separate corpus job checks that printing a parsed template reproduces it byte for byte, which is the strongest single statement that nothing was lost or misplaced on the way in. Helper transformations were made faithful to what Rails actually emits, in attribute ordering ([#1576](https://github.com/marcoroth/herb/pull/1576)), attribute quoting ([#1577](https://github.com/marcoroth/herb/pull/1577)), and source locations for synthesized attributes ([#1451](https://github.com/marcoroth/herb/pull/1451)). The error catalog grew from 23 to 38 typed errors, so consumers can branch on a type instead of matching message strings. RBS signatures are now validated on CI ([#1712](https://github.com/marcoroth/herb/pull/1712), [#1711](https://github.com/marcoroth/herb/pull/1711)), so the published types cannot drift from the implementation.

**And Herb's own upgrades.** The same idea applies one level up. Version-gated linter rules ([#1453](https://github.com/marcoroth/herb/pull/1453)) let a rule declare the version it arrived in, and it stays quiet when your `.herb.yml` pins something older. Adding 25 rules in one release, as this one did, would otherwise have broken every pinned configuration.

**What is still outstanding for 1.0:** a formally stable public API across all five bindings, explicit backwards compatibility guarantees for the AST format itself, and comprehensive documentation of every public API. Those are the remaining gate to a 1.0 release.

### 2. Groundwork for Exploring Reactivity

The commitment here was deliberately modest: lay the groundwork for *exploring* reactivity, not deliver it. That bar was cleared with room to spare, though it's worth saying plainly that reactivity itself is still not something you can ship in production today.

**Shipped in this release:**

- Static resolution of the render graph, with `ERBRenderNode` in the AST and a project-wide `RenderAnalyzer` ([#1385](https://github.com/marcoroth/herb/pull/1385), [#1663](https://github.com/marcoroth/herb/pull/1663))
- An Action View helper registry, code-generated into all five bindings ([#1611](https://github.com/marcoroth/herb/pull/1611))
- Tag helper decomposition into equivalent HTML, which is what brings the granularity down from a whole template to a single attribute
- A syntax tree diff engine in C, with twelve typed operations and node paths that map to document positions ([#1518](https://github.com/marcoroth/herb/pull/1518))
- A WebSocket dev server that turns those diffs into live DOM patches ([#1662](https://github.com/marcoroth/herb/pull/1662))
- Compile-time optimizations as a measurable side effect, 3x to 22x on realistic templates ([#1613](https://github.com/marcoroth/herb/pull/1613))

**Built during the grant, landed just after this release:** two pieces missed the v0.10 cut and are now on `main` for v0.11. State dependency tracing with the reverse node index ([#1667](https://github.com/marcoroth/herb/pull/1667)), and compile-time inlining of static partials ([#1666](https://github.com/marcoroth/herb/pull/1666)). The second one closed [issue #654](https://github.com/marcoroth/herb/issues/654), the tracking issue for eliminating Action View's per-call partial lookup overhead.

**Already underway since:** what would have been the "not started" list when this release was cut has since started moving on `main`. The wire format exists ([#2273](https://github.com/marcoroth/herb/pull/2273)). It is a payload naming the template, version and rendering each value came from, so a client can join it to the markers on the page. The client runtime can now set a page's state too, and write the slots it can answer for itself without waiting for the server ([#2282](https://github.com/marcoroth/herb/pull/2282)). The current direction keeps state in the query string and the server stateless, so the back button and bookmarking keep working, which is a different shape from LiveView's persistent channel.

What genuinely remains is making it something you can switch on in a Rails app. That is the next ReActionView release, and it sits beyond what this grant covered.

### What the Grant Made Possible

The short version: reactivity in Ruby ERB was not blocked on wanting it. It was blocked on the engine not understanding templates well enough to know what changed. That understanding is now built.

The clearest evidence that the groundwork was the right thing to fund is what is already happening on top of it. Work on v0.11 is well underway on `main`, where a new [`@herb-tools/analysis`](https://github.com/marcoroth/herb/pull/2168) package builds the project-wide state and render indexes, the engine compiles templates into addressable **slots**, and a browser client applies state payloads straight to the slots that changed. The primitives this post describes are being wired together into actual reactive rendering, and that phase started weeks after this release.

Reactivity is only the headline. Plenty of unrelated work has piled up on `main` alongside it, from a large batch of new and improved linter rules to more language server features, formatter fixes, and parser additions. v0.11 will get its own post when it's ready.

Thank you to [gem.coop](https://gem.coop) and [Contributed Systems](https://contribsys.com) for funding work that is genuinely hard to fund any other way. Months of parser and analysis infrastructure does not attract money on its own.


## Future Work

### Landing the Reactivity Foundation

Both pieces described earlier have now merged, which closes out the static analysis half of the reactivity path. The next step is turning that analysis into rendering, which is what v0.11 is about.

### Towards Herb 1.0

Three things still gate a 1.0 release, all of them listed as outstanding in the report above. Herb needs a formally stable public API across all bindings, backwards compatibility guarantees for the AST format, and comprehensive documentation for every public API. It also needs more adoption in big codebases, so we can be sure the foundation holds up.

### Production Reactivity

The wire format and the client-side state runtime are already taking shape in v0.11. What remains is the Rails integration layer that makes it a switch you can flip in an application, which lands with a future ReActionView release. This is Level 4 of the [six adoption levels of ReActionView](https://marcoroth.dev/posts/railsconf-2025-recap).

### Expanding In-Place Patching

The dev server currently patches text and attribute changes in place and reloads for everything else. The diff engine already produces twelve operation types, so there's a lot of headroom to patch more of them without a reload.

### More Linter Rules

The rule catalog keeps growing, with a healthy backlog of [rule proposals](https://github.com/marcoroth/herb/issues?q=is%3Aopen%20is%3Aissue%20label%3Alinter-rule) open. Many existing rules still need autocorrectors.

---

We're excited about this release and the road ahead. Get involved, check out the [open issues](https://github.com/marcoroth/herb/issues), or reach out if you'd like to help shape Herb's future.

If you have an idea on how Herb could help with improving the developer experience in your current workflow, please [**open an issue on GitHub**](https://github.com/marcoroth/herb/issues/new/choose) and let's discuss.


## Acknowledgments

This release is the largest community effort so far: 22 contributors, 376 commits, and 17 people making their first contribution to the project. Thank you to everyone who submitted a pull request, reported an issue, tested an early build, or shared feedback.

A particular thank you to [Joel Hawksley](https://github.com/joelhawksley). Championing a young parser inside a codebase the size of GitHub's is not a small thing to take on. He did it thoroughly, filing what broke, [writing the adoption up publicly](https://hawksley.org/2026/05/06/adopting-herb-at-github.html) including the parts we can improve, and then fixing things himself. Feedback from a codebase that size is the kind of thing you cannot buy, and he has kept giving it.

Thank you as well to [Marko Kajzer](https://github.com/markokajzer), whose steady stream of linter work runs through this whole release.

Thank you to the [Gem Fellowship](https://gem.coop/fellowship/) program, reported on above. That funding is real and it matters. The grant and the sponsorships together cover a fraction of the time that went into this release. That was my decision to make and I'd make it again, because I think the Ruby view layer is worth this. But "sustainable" would be the wrong word for it, and saying otherwise would suggest a problem is solved when it isn't.

If Herb is useful to you or your company, consider [sponsoring the project](https://github.com/sponsors/marcoroth) on GitHub. And to everyone already sponsoring, at any amount: thank you, genuinely!

Your input, time, and belief in the project continue to drive its progress and make the ecosystem better for everyone. Thank you, and happy hacking!

~ Marco
