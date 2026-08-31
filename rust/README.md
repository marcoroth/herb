# Herb Rust Bindings

Rust bindings for Herb - An ecosystem of powerful and seamless developer tools for HTML+ERB templates.

## Crates

This is a Cargo workspace. `herb` is the binding to the C library, the rest build on top of it.

| Crate                                    | Binary           | Description                                                  |
|------------------------------------------|------------------|--------------------------------------------------------------|
| [`herb`](./)                             | `herb-rust`      | Bindings to the Herb C library: lexing, parsing, and the AST |
| [`herb-config`](./herb-config)           |                  | Shared configuration utilities, reads `.herb.yml`            |
| [`herb-highlighter`](./herb-highlighter) | `herb-highlight` | Syntax highlighter, snippet renderer and diagnostic renderer |
| [`herb-printer`](./herb-printer)         | `herb-print`     | Printers that reconstruct source from a Herb AST             |

Each binary sits behind the crate's `cli` feature, so a library consumer does not pull in its dependencies:

```bash
cargo build -p herb-highlighter --features herb-highlighter/cli
cargo build -p herb-printer --features herb-printer/cli
```

## Building

### Prerequisites

- Rust toolchain
- Bundler with Prism gem installed in the parent directory

### Build

```bash
make build
make release
make all
```

## Usage

### CLI (within the Herb repo)

```bash
./bin/herb-rust version

./bin/herb-rust lex path/to/file.erb

./bin/herb-rust parse path/to/file.erb
```

The other crates ship their own binaries:

```bash
cargo run -p herb-highlighter --features herb-highlighter/cli -- path/to/file.html.erb
cargo run -p herb-printer --features herb-printer/cli -- path/to/file.html.erb
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
make test
cargo test
```

## Benchmarking

The benchmarks are written with [divan](https://github.com/nvzqz/divan) through the [CodSpeed](https://codspeed.io) compatibility layer and are tracked on every push and pull request:

| Benchmark suite                                          | Covers                                                        |
|----------------------------------------------------------|---------------------------------------------------------------|
| [`benches/parser.rs`](./benches/parser.rs)               | Lexing, parsing, Ruby/HTML extraction and diffing             |
| [`herb-printer/benches/printer.rs`](./herb-printer/benches/printer.rs) | Identity, indent and ERB-to-Ruby-string printing    |

Every benchmark runs against three input sizes: a small component (`small`), a realistic page layout (`page`), and that layout repeated 25 times (`large`).

Run them locally with `divan` (walltime):

```bash
cargo bench -p herb -p herb-printer
```

Or run them the same way CI does, with CodSpeed's CPU simulation:

```bash
cargo codspeed build --measurement-mode simulation --package herb --package herb-printer
codspeed run --mode simulation -- cargo codspeed run --package herb --package herb-printer
```

## Publishing

Before publishing to crates.io, vendor the C sources:

```bash
make vendor
cargo publish --allow-dirty
```

The `vendor/` directory is gitignored to avoid committing duplicate files. The `make vendor` task copies C sources from the parent directory into `vendor/libherb` and `vendor/prism` so the published crate is self-contained.

Only `herb` is published today. The other crates carry the metadata to be published with `cargo publish -p <crate>`, and depend on each other by version as well as by path so that packaging resolves. They have to go out in dependency order, `herb` and `herb-config` before `herb-printer`, since Cargo resolves the version side of a path dependency against crates.io.

## Cleaning

```bash
make clean
```
