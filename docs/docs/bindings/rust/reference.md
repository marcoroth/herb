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

The `herb::lex` function tokenizes an HTML document with embedded Ruby and returns a `Result<LexResult, String>` containing all tokens.

### `herb::lex(source: &str) -> Result<LexResult, String>`

:::code-group
```rust
use herb::lex;

let source = "<p>Hello <%= user.name %></p>";

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

The `ParseResult` struct provides access to the parsed AST and any parse-level errors:

```rust
pub struct ParseResult {
  pub value: DocumentNode,
  pub source: String,
  pub errors: Vec<AnyError>,
}

impl ParseResult {
  pub fn tree_inspect(&self) -> String;
  pub fn errors(&self) -> &[AnyError];
  pub fn recursive_errors(&self) -> Vec<&dyn ErrorNode>;
  pub fn failed(&self) -> bool;
  pub fn success(&self) -> bool;
}
```

**Methods:**

- `tree_inspect()` - Returns a string representation of the AST
- `errors()` - Returns only the parse-level errors as `AnyError` enum variants
- `recursive_errors()` - Returns parse-level errors combined with all node errors recursively as trait objects (`&dyn ErrorNode`)
- `failed()` - Returns `true` if there are any errors (parse-level or node errors)
- `success()` - Returns `true` if there are no errors

**Example with error handling:**

:::code-group
```rust
use herb::parse;

let source = "<div></span>"; // Mismatched tags

match parse(source) {
  Ok(result) => {
    if result.failed() {
      println!("Parsing failed with {} errors:", result.recursive_errors().len());

      for error in result.recursive_errors() {
        println!("  {} at {}: {}",
          error.error_type(),
          error.location(),
          error.message()
        );
      }
    } else {
      println!("Parse successful!");
      println!("{}", result.tree_inspect());
    }
  }
  Err(e) => {
    eprintln!("Parse error: {}", e);
  }
}
```
:::

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
// Output: "herb rust v0.8.9, libprism v1.8.0, libherb v0.8.9 (Rust FFI)"
```
:::

### `herb::herb_version() -> String`

Returns just the Herb library version:

:::code-group
```rust
use herb::herb_version;

println!("{}", herb_version());
// Output: "0.8.9"
```
:::

### `herb::prism_version() -> String`

Returns the Prism parser version:

:::code-group
```rust
use herb::prism_version;

println!("{}", prism_version());
// Output: "1.8.0"
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
  fn errors(&self) -> &[AnyError];
  fn child_nodes(&self) -> Vec<&dyn Node>;
  fn recursive_errors(&self) -> Vec<&dyn ErrorNode>;
  fn tree_inspect(&self) -> String;
}
```

**Methods:**

- `node_type()` - Returns the type of the node (e.g., "DocumentNode", "HTMLElementNode")
- `location()` - Returns the source location span of the node
- `errors()` - Returns direct errors on this node as `AnyError` enum variants
- `child_nodes()` - Returns all child nodes as trait objects (`&dyn Node`), including both generic and specific-typed fields
- `recursive_errors()` - Returns all errors from this node and its children recursively as trait objects (`&dyn ErrorNode`)
- `tree_inspect()` - Returns a formatted string representation of the node and its children

### Error Handling

Parse errors use a trait-based system for flexibility and type safety. All errors implement the `ErrorNode` trait:

```rust
pub trait ErrorNode {
  fn error_type(&self) -> &str;
  fn message(&self) -> &str;
  fn location(&self) -> &Location;
  fn tree_inspect(&self) -> String;
}
```

Errors remain accessible through the `errors()` method on nodes (returning `&[AnyError]`) or `recursive_errors()` (returning `Vec<&dyn ErrorNode>`), allowing you to handle them as needed.
