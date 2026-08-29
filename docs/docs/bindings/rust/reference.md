---
outline: deep
---

# Rust Reference

The `herb` crate exposes functions for lexing, parsing, and extracting Ruby and HTML from HTML+ERB source code.

## Rust API

`herb` provides the following key functions:

* `herb::lex(source)`
* `herb::parse(source)`
* `herb::parse_with_options(source, options)`
* `herb::extract_ruby(source)`
* `herb::extract_ruby_with_options(source, options)`
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
// Output: "             user.name  ;    "
```
:::

### `herb::extract_ruby_with_options(source: &str, options: &ExtractRubyOptions) -> Result<String, String>`

Extract Ruby with custom options.

#### Default behavior

By default, the output is position-preserving with semicolons:

:::code-group
```rust
use herb::extract_ruby;

let source = "<% x = 1 %> <% y = 2 %>";

match extract_ruby(source) {
  Ok(ruby) => println!("{:?}", ruby),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "   x = 1  ;    y = 2  ;"
```
:::

#### Without semicolons

:::code-group
```rust
use herb::{extract_ruby_with_options, ExtractRubyOptions};

let source = "<% x = 1 %> <% y = 2 %>";
let options = ExtractRubyOptions {
  semicolons: false,
  ..Default::default()
};

match extract_ruby_with_options(source, &options) {
  Ok(ruby) => println!("{:?}", ruby),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "   x = 1       y = 2   "
```
:::

#### Including ERB comments

:::code-group
```rust
use herb::{extract_ruby_with_options, ExtractRubyOptions};

let source = "<%# comment %>\n<% code %>";
let options = ExtractRubyOptions {
  comments: true,
  ..Default::default()
};

match extract_ruby_with_options(source, &options) {
  Ok(ruby) => println!("{:?}", ruby),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "  # comment   \n   code  ;"
```
:::

#### Without position preservation

Use `preserve_positions: false` for readable output where each ERB tag is placed on its own line:

:::code-group
```rust
use herb::{extract_ruby_with_options, ExtractRubyOptions};

let source = "<%# comment %><%= something %>";
let options = ExtractRubyOptions {
  preserve_positions: false,
  comments: true,
  ..Default::default()
};

match extract_ruby_with_options(source, &options) {
  Ok(ruby) => println!("{:?}", ruby),
  Err(e) => eprintln!("Error: {}", e),
}
// Output: "# comment \n something "
```
:::

### `ExtractRubyOptions`

The `ExtractRubyOptions` struct provides configuration for Ruby extraction:

```rust
pub struct ExtractRubyOptions {
  pub semicolons: bool,
  pub comments: bool,
  pub preserve_positions: bool,
}

impl Default for ExtractRubyOptions {
  fn default() -> Self {
    Self {
      semicolons: true,
      comments: false,
      preserve_positions: true,
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `semicolons` | `true` | Add `;` at the end of each ERB tag to separate statements |
| `comments` | `false` | Include ERB comments (`<%# %>`) in the output |
| `preserve_positions` | `true` | Maintain character positions by padding with whitespace |

> [!TIP]
> Use `preserve_positions: false` when you need readable Ruby output.
> Use `preserve_positions: true` (default) when you need accurate error position mapping.

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
// Output: "herb rust v0.10.3, libprism v1.9.0, libherb v0.10.3 (Rust FFI)"
```
:::

### `herb::herb_version() -> String`

Returns just the Herb library version:

:::code-group
```rust
use herb::herb_version;

println!("{}", herb_version());
// Output: "0.10.3"
```
:::

### `herb::prism_version() -> String`

Returns the Prism parser version:

:::code-group
```rust
use herb::prism_version;

println!("{}", prism_version());
// Output: "1.9.0"
```
:::

## Locating a Node

### `herb::locate(node: &dyn Node, position: Position) -> Option<LocateResult>`

Finds the most specific node at a position, and the nodes it sits inside. A position that comes back from a rendered page, an editor, or a diagnostic is a node before it is anything anyone can act on, and this is what turns one into the other.

A node's location contains its start and stops short of its end, so two nodes sitting next to each other never both answer for the character between them. A node with no location of its own answers for nothing, which keeps a synthesized node from swallowing the position of the node it was built next to. A position outside everything the given node covers belongs to no node.

Ancestors read nearest first, so the enclosing element a caller wants is the first one that answers.

Columns are 0-based character offsets into their line, which is what the parser reports.

```rust
use herb::locate::locate;
use herb::position::Position;

let result = herb::parse("<div><span>hi</span></div>").unwrap();
let found = locate(&result.value, Position::new(1, 12)).unwrap();

found.node.node_type();
// => "AST_HTML_TEXT_NODE"

found.ancestors.iter().map(|node| node.node_type()).collect::<Vec<_>>();
// => ["AST_HTML_ELEMENT_NODE", "AST_HTML_ELEMENT_NODE", "AST_DOCUMENT_NODE"]

found.innermost(|node| node.node_type() == "AST_HTML_ELEMENT_NODE");
// => the nearest element the position is inside

found.path();
// => outermost first, ending with the node that was found
```

`innermost` starts with the node itself, so it answers with the node when the node already matches the predicate. A position that belongs to no node answers `None`.

A parse result answers for the document it parsed, so the result a caller already has can be handed over directly. ``herb::locatable`` asks the same question without walking, and answers whether a position falls anywhere inside a node or what it holds.

The walk goes by how much source a node and everything it holds cover together, which is not the same as the node's own location. A branch of an `if` holds the branch after it, and each branch is positioned where it was written, so the node holding the chain ends before what it holds. Walking by a node's own location would leave every branch but the first unreachable. `ancestors` is therefore the walk that was taken, whether or not each node along it covers the position itself, and a caller that wants only the nodes the position is really inside filters on `node.location().contains(position)`.

The positions this reads come from `Location::contains`, `Location::covers` and `Location::is_empty`. `Position` derives `Ord`, so positions compare and sort the way they read.

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
