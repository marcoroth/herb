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

### CLI (within the Herb repo)

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

## Publishing

Before publishing to crates.io, vendor the C sources:

```bash
make vendor                        # Vendor C sources from ../src and prism
cargo publish --allow-dirty        # Publish to crates.io
```

The `vendor/` directory is gitignored to avoid committing duplicate files. The `make vendor` task copies C sources from the parent directory into `vendor/libherb` and `vendor/prism` so the published crate is self-contained.

## Cleaning

```bash
make clean
```
