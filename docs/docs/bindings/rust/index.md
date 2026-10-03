---
outline: deep
---

# Herb Rust Bindings

Herb provides official Rust bindings through FFI (Foreign Function Interface) to the C library, allowing you to parse HTML+ERB in Rust projects with native performance.

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [Ruby](/bindings/ruby/)
> - [JavaScript/Node.js](/bindings/javascript/)
> - [Java](/bindings/java/)

## Installation

Add the dependency to your `Cargo.toml`:

:::code-group
```toml [Cargo.toml]
[dependencies]
herb = "0.11.0"
```
:::

Or use `cargo` to add the dependency to your project:

:::code-group
```shell
cargo add herb
```
:::

## Getting Started

Import the crate and parse:

:::code-group
```rust
use herb::parse;

fn main() {
  let source = "<h1><%= user.name %></h1>";

  match parse(source) {
    Ok(result) => println!("{}", result.tree_inspect()),
    Err(e) => eprintln!("Parse error: {}", e),
  }
}
```
:::

Every entry point returns a `Result`, so a failure in the C library surfaces as an `Err` with a message instead of a panic.

## The API

The API pages document each call once, with a Rust tab alongside the other bindings.

| Page | Rust functions |
| --- | --- |
| [Parsing](/bindings/parsing) | `herb::parse`, `herb::parse_with_options` |
| [Lexing](/bindings/lexing) | `herb::lex` |
| [Extracting Ruby and HTML](/bindings/extracting) | `herb::extract_ruby`, `herb::extract_ruby_with_options`, `herb::extract_html` |
| [Working with the tree](/bindings/tree) | `herb::Visitor`, `herb::locate` |
| [Versions](/bindings/versions) | `herb::version`, `herb::herb_version`, `herb::prism_version` |

Reading a file is up to you, so there is no `parse_file`. Pass the contents to `parse`.
