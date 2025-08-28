---
outline: deep
---

# Herb Ruby Bindings

Herb is bundled and packaged up as a precompiled RubyGem and available to be installed from [RubyGems.org](https://rubygems.org).

> [!TIP] More Language Bindings
> Herb also has [bindings for JavaScript/Node.js](/bindings/javascript/)

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

You are now ready to parse, format, lint, and print HTML+ERB in Ruby. See the [Quick Start](#quick-start) section below for basic usage.

## Multi-Backend Architecture

Herb for Ruby features a sophisticated multi-backend architecture that allows you to choose the best backend for your specific use case:

- **Native Backend** (default) - Ruby C extension for parsing and lexing
- **Node Backend** - Uses Node.js packages for advanced features like formatting and linting
- **FFI Backend** - Foreign Function Interface backend (planned for future release)
- **WASM Backend** - WebAssembly backend (planned for future release)

### Backend Selection

Herb automatically selects the best available backend, but you can choose manually:

```ruby
Herb.switch_backend(:native)  # Native Ruby C-Extension Backend
Herb.switch_backend(:node)    # Full feature set

Herb.current_backend
# => "native"

Herb.available_backends
# => [:native, :node]
```

### Cross-Backend Operations

You can use different backends for different operations without switching:


```ruby
# Parse with native backend
result = Herb.parse(source)

# Parse with Node backend
formatted = Herb.parse(source, backend: :node)

# Switch to Node backend
Herb.switch_backend(:node)

# Now uses Node backend for parsing
result = Herb.parse(source)
```

## Quick Start

Once installed, you can start parsing, formatting, and linting HTML+ERB templates:

:::code-group
```ruby
require "herb"

# Parse HTML+ERB templates
result = Herb.parse('<div>Hello <%= user.name %>!</div>')

# Format templates
formatted = Herb.format('<div><span>Messy</span></div>')

# Lint templates for issues
lint_result = Herb.lint('<img src="photo.jpg">')

# Convert AST back to HTML
node = result.value
html_output = node.to_source
```
:::

For detailed examples and API reference, see the [Ruby Reference](/bindings/ruby/reference) documentation.
