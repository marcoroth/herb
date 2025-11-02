---
outline: deep
---

# Rust Reference

The `herb` crate exposes functions for lexing, parsing, and extracting Ruby and HTML from HTML+ERB source code.

## Rust API

`herb` provides the following key functions:

* `herb::lex(source)`
* `herb::parse(source)`
* `herb::extract_ruby(source)`
* `herb::extract_html(source)`
* `herb::version()`
* `herb::herb_version()`
* `herb::prism_version()`

## Lexing

The `herb::lex` function tokenizes an HTML document with embedded Ruby and returns a `LexResult` containing all tokens.

### `herb::lex(source: &str) -> LexResult`

:::code-group
```rust
use herb::lex;

let source = "<p>Hello <%= user.name %></p>";
let result = lex(source);

for token in result.tokens() {
  println!("{}", token.inspect());
}
// Output:
// #<Herb::Token type="TOKEN_HTML_TAG_START" value="<" range=[0, 1] start=(1:0) end=(1:1)>
// #<Herb::Token type="TOKEN_IDENTIFIER" value="p" range=[1, 2] start=(1:1) end=(1:2)>
// #<Herb::Token type="TOKEN_HTML_TAG_END" value=">" range=[2, 3] start=(1:2) end=(1:3)>
// ...
```
:::

### `LexResult`

The `LexResult` struct provides access to the lexed tokens:

```rust
pub struct LexResult {
  pub tokens: Vec<Token>,
}

impl LexResult {
  pub fn tokens(&self) -> &[Token];
}
```

## Parsing

The `herb::parse` function parses an HTML document with embedded Ruby and returns a `Result<ParseResult, String>` containing the parsed AST.

### `herb::parse(source: &str) -> Result<ParseResult, String>`

:::code-group
```rust
use herb::parse;

let source = "<p>Hello <%= user.name %></p>";

match parse(source) {
  Ok(result) => {
    println!("{}", result.tree_inspect());
  }
  Err(e) => {
    eprintln!("Parse error: {}", e);
  }
}
// Output:
// @ DocumentNode (location: (1:0)-(1:29))
// └── children: (1 item)
//     └── @ HTMLElementNode (location: (1:0)-(1:29))
//         ├── open_tag:
//         │   └── @ HTMLOpenTagNode (location: (1:0)-(1:3))
//         │       ├── tag_opening: "<" (location: (1:0)-(1:1))
//         │       ├── tag_name: "p" (location: (1:1)-(1:2))
//         │       ├── tag_closing: ">" (location: (1:2)-(1:3))
//         │       ├── children: []
//         │       └── is_void: false
//         │
//         ├── tag_name: "p" (location: (1:1)-(1:2))
//         ├── body: (2 items)
//         │   ├── @ HTMLTextNode (location: (1:3)-(1:9))
//         │   │   └── content: "Hello "
//         │   │
//         │   └── @ ERBContentNode (location: (1:9)-(1:25))
//         │       ├── tag_opening: "<%=" (location: (1:9)-(1:12))
//         │       ├── content: " user.name " (location: (1:12)-(1:23))
//         │       ├── tag_closing: "%>" (location: (1:23)-(1:25))
//         │       ├── parsed: false
//         │       └── valid: false
//         │
//         ├── close_tag:
//         │   └── @ HTMLCloseTagNode (location: (1:25)-(1:29))
//         │       ├── tag_opening: "</" (location: (1:25)-(1:27))
//         │       ├── tag_name: "p" (location: (1:27)-(1:28))
//         │       ├── children: []
//         │       └── tag_closing: ">" (location: (1:28)-(1:29))
//         │
//         ├── is_void: false
//         └── source: ""
```
:::

### `ParseResult`

The `ParseResult` struct provides access to the parsed AST tree inspect output:

```rust
pub struct ParseResult {
  pub tree_inspect: String,
}

impl ParseResult {
  pub fn tree_inspect(&self) -> &str;
}
```

## Extracting Code

### `herb::extract_ruby(source: &str) -> Result<String, String>`

The `extract_ruby` function extracts only the Ruby parts of an HTML document with embedded Ruby.

:::code-group
```rust
use herb::extract_ruby;

let source = "<p>Hello <%= user.name %></p>";

match extract_ruby(source) {
  Ok(ruby) => println!("{}", ruby),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "             user.name       "
```
:::

### `herb::extract_html(source: &str) -> Result<String, String>`

The `extract_html` function extracts only the HTML parts of an HTML document with embedded Ruby.

:::code-group
```rust
use herb::extract_html;

let source = "<p>Hello <%= user.name %></p>";

match extract_html(source) {
  Ok(html) => println!("{}", html),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "<p>Hello                 </p>"
```
:::

## Version Information

### `herb::version() -> String`

Returns the full version information including Herb, Prism, and FFI details:

:::code-group
```rust
use herb::version;

println!("{}", version());
// Output: "herb rust v0.7.5, libprism v1.6.0, libherb v0.7.5 (Rust FFI)"
```
:::

### `herb::herb_version() -> String`

Returns just the Herb library version:

:::code-group
```rust
use herb::herb_version;

println!("{}", herb_version());
// Output: "0.7.5"
```
:::

### `herb::prism_version() -> String`

Returns the Prism parser version:

:::code-group
```rust
use herb::prism_version;

println!("{}", prism_version());
// Output: "1.6.0"
```
:::

## AST Types

The parsed AST consists of various node types that represent different parts of the document:

### Core Types

```rust
// Position in the source
pub struct Position {
  pub line: u32,
  pub column: u32,
}

// Location span in the source
pub struct Location {
  pub start: Position,
  pub end: Position,
}

// Token from lexing
pub struct Token {
  pub value: String,
  pub token_type: String,
  pub location: Location,
}
```

### AST Node Types

All AST nodes implement the `Node` trait:

```rust
pub trait Node {
  fn node_type(&self) -> &str;
  fn location(&self) -> &Location;
  fn errors(&self) -> &[ErrorNode];
  fn tree_inspect(&self) -> String;
}
```

### Error Handling

Parse errors are included in the AST as `ErrorNode` structs:

```rust
pub struct ErrorNode {
  pub error_type: String,
  pub location: Location,
  pub message: String,
}
```

Errors remain accessible through the `errors()` method on nodes, allowing you to handle them as needed.
