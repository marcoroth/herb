---
title: Welcome
---

<div align="center">
  <img src="/herb.svg" alt="Herb Logo" width="200" height="200">
</div>

# Welcome to Herb

**Herb is a modern templating language for the HTML+ERB you already have.**

Your `.html.erb` files are already HTML+ERB. Herb reads them as one document, where the HTML elements and the Ruby tags belong to the same tree, and everything Herb does starts from that tree. You do not rewrite a template to use it.

## What Herb does for your templates

Herb catches the mistakes ERB lets through. An `<h2>` closed with `</h3>`, a `<div>` opened inside an `if` and closed outside it, and an ERB tag missing its `%>` all compile under Erubi, and the browser repairs the HTML as best it can. Herb reports each one with the file, the line and what to change, before the page renders.

Herb renders templates with `Herb::Engine`, which compiles the same templates Erubi does and escapes each `<%= %>` for where it sits, so a value inside an attribute or a `<script>` cannot break out of it. In development, problems show up as an overlay on the page instead of a stack trace.

Herb also covers the rest of working on a template. The [linter](/projects/linter) checks HTML, ERB, accessibility and Action View conventions, the [formatter](/projects/formatter) formats templates consistently, and the [language server](/projects/language-server) puts both in your editor as you type. The [dev server](/projects/dev-server) patches the open page when you save a template.

When a page needs to respond in the browser, Herb lets the template say so. A template can declare [state](/language/state) the browser owns, write it with an [action attribute](/language/actions), and have every part of the page that reads it update in place, without writing a controller. That part is experimental, and the rest of Herb does not depend on it.

## How it works

The Herb parser is written in C and reads HTML and ERB in one pass, handing the Ruby inside each tag to [Prism](https://github.com/ruby/prism). The tree it produces is the same in Ruby, JavaScript, Java, Rust and the browser, so every tool sees a template the same way.

`Herb::Engine` compiles that tree to Ruby, the way Erubi compiles ERB, and a template renders the same under both. With [slots](/language/slots) on, the engine also marks the dynamic parts of the output, and the [client runtime](/projects/client) uses those marks to update a part of the page without replacing the rest.

With the Rails 8.2 framework defaults, Rails renders HTML templates with `Herb::Engine`, so a Rails app gets the parsing and the escaping without installing anything. [ReActionView](https://reactionview.dev) is what makes those templates reactive, and what puts the error overlays and the dev tools on the page.

## Goals

Herb exists so that writing HTML+ERB is as well supported as writing Ruby. That means precise errors with a line and a column, tools that agree with each other because they share one parser, and an engine that renders what the tools checked.

Herb also aims to keep the templates you write ordinary. A template that uses Herb's features still reads as HTML+ERB. Directives are ERB comments and actions are HTML attributes, so the file stays something any Rails developer can read.

## How we got here

ERB never had tooling that understood HTML. Ruby tooling improved a great deal with Prism, but HTML+ERB files still had no syntax checking, no formatting and no structural understanding. At the same time, [Hotwire](https://hotwired.dev), [htmx](https://htmx.org) and similar tools put more weight on server-rendered HTML than ever.

The Herb parser was first shown at [RubyKaigi 2025](https://www.rubyevents.org/talks/empowering-developers-with-html-aware-erb-tooling-rubykaigi-2025). The linter, the formatter, the language server and the vision for ReActionView followed at [RailsConf 2025](https://www.rubyevents.org/talks/the-modern-view-layer-rails-deserves-a-vision-for-2025-and-beyond). `Herb::Engine`, ReActionView and the dev tools launched at [Rails World 2025](https://www.rubyevents.org/talks/introducing-reactionview-an-actionview-compatible-erb-engine).

The [SF Ruby 2025 keynote](https://www.rubyevents.org/talks/keynote-herb-to-reactionview-a-new-foundation-for-the-view-layer) told the story of how Herb came to be. At [RubyKaigi 2026](https://www.rubyevents.org/talks/html-aware-erb-the-path-to-reactive-rendering), the talk walked the path from structural understanding to reactive rendering. Herb v0.10 shipped with it, bringing the syntax tree diff engine, the dev server and render graph analysis.

## Where to go next

[Installation](/installation) sets up the gem, the linter, the formatter and your editor. [Language](/language/) is the reference for everything Herb reads in a template. For a guided start in a Rails app, begin with [ReActionView](https://reactionview.dev/overview).
