---
outline: deep
---

# Herb Rust Bindings

Herb provides official Rust bindings through FFI (Foreign Function Interface) to the C library, allowing you to parse HTML+ERB in Rust projects with native performance.

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [Ruby](/bindings/ruby/)
> - [JavaScript/Node.js](/bindings/javascript/)

## Installation

Add the dependency to your `Cargo.toml`:

:::code-group
```toml [Cargo.toml]
[dependencies]
herb = "0.8.5"
```
:::

Or use `cargo` to add the dependency to your project:

:::code-group
```shell
cargo add herb
```
:::

## Getting Started

Import the `herb` crate in your project:

:::code-group
```rust
use herb::{parse, lex};
```
:::

You are now ready to parse HTML+ERB in Rust.

### Basic Example

Here's a simple example of parsing HTML+ERB:

:::code-group
```rust
use herb::parse;

fn main() {
  let source = "<h1><%= user.name %></h1>";

  match parse(source) {
    Ok(result) => {
      println!("{}", result.tree_inspect());
    }
    Err(e) => {
      eprintln!("Parse error: {}", e);
    }
  }
}
```
:::

### Lexing Example

You can also tokenize HTML+ERB source:

:::code-group
```rust
use herb::lex;

fn main() {
  let source = "<h1><%= user.name %></h1>";

  match lex(source) {
    Ok(result) => {
      println!("{}", result);

      for token in result.tokens() {
        // do something with each token
      }
    }
    Err(e) => {
      eprintln!("Lex error: {}", e);
    }
  }
}
```
:::
