---
outline: deep
---

# Herb Ruby Bindings

Herb is bundled and packaged up as a precompiled RubyGem and available to be installed from [RubyGems.org](https://rubygems.org).

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [JavaScript/Node.js](/bindings/javascript/)
> - [Java](/bindings/java/)
> - [Rust](/bindings/rust/)

## Installation

Add the gem to your `Gemfile`:

:::code-group
```ruby [Gemfile]
gem "herb"
```
:::

or use `bundler` to add the dependency to your project:

:::code-group
```shell
bundle add herb
```
:::

or add it to your gemspec when you want to use Herb in a gem:

:::code-group
```ruby [yourgem.gemspec]
spec.add_dependency "herb", "~> 0.1"
```
:::

## Getting Started

In your project `require` the gem:

:::code-group
```ruby
require "herb"

Herb.parse("<h1><%= title %></h1>")
```
:::

The gem ships the `herb` command as well, which runs the same parser from the terminal. `bundle exec herb --help` lists what it can do.

## The API

The API pages document each call once, with a Ruby tab alongside the other bindings.

| Page | Ruby methods |
| --- | --- |
| [Parsing](/bindings/parsing) | `Herb.parse`, `Herb.parse_file` |
| [Lexing](/bindings/lexing) | `Herb.lex`, `Herb.lex_file` |
| [Extracting Ruby and HTML](/bindings/extracting) | `Herb.extract_ruby`, `Herb.extract_html` |
| [Working with the tree](/bindings/tree) | `Herb::Visitor`, `locate` |
| [Versions](/bindings/versions) | `Herb.version` |
