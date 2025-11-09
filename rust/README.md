# Herb Rust Bindings

Rust bindings for Herb - Powerful and seamless HTML-aware ERB parsing and tooling.

## Building

### Prerequisites

- Rust toolchain
- Bundler with Prism gem installed in the parent directory

### Build

```bash
make build        # Build debug binary
make release      # Build release binary
make all          # Generate templates and build
```

## Usage

### CLI

```bash
./bin/herb-rust version

./bin/herb-rust lex path/to/file.erb

./bin/herb-rust parse path/to/file.erb
```

### As a Library

```rust
use herb::{lex, parse};

fn main() {
  let template = "<h1><%= title %></h1>";

  match lex(template) {
    Ok(result) => { println!("{}", result); }
    Err(error) => { eprintln!("Lex error: {}", error); }
  }

  match parse(template) {
    Ok(result) => { println!("{}", result); }
    Err(error) => { eprintln!("Parse error: {}", error); }
  }
}
```

## Testing

```bash
cargo test
```

## Cleaning

```bash
make clean
```
