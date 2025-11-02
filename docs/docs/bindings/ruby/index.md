---
outline: deep
---

# Herb Ruby Bindings

Herb is bundled and packaged up as a precompiled RubyGem and available to be installed from [RubyGems.org](https://rubygems.org).

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [JavaScript/Node.js](/bindings/javascript/)
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
```
:::

You are now ready to parse HTML+ERB in Ruby.
