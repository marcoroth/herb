---
outline: deep
---

# Parsing

Parsing reads HTML+ERB into a syntax tree. The result carries the document, the errors the parser found and the options it ran with, so a template that does not parse cleanly still gives you a tree and a list of what is wrong with it.

## Parse a string

::: code-group
```ruby [Ruby]
source = %(<p>Hello <%= user.name %></p>)

result = Herb.parse(source)
result.value
```

```js [JavaScript]
const source = "<p>Hello <%= user.name %></p>"

const result = Herb.parse(source)
result.value
```

```java [Java]
import org.herb.Herb;
import org.herb.ParseResult;

String source = "<p>Hello <%= user.name %></p>";

ParseResult result = Herb.parse(source);
result.value;
```

```rust [Rust]
use herb::parse;

let source = "<p>Hello <%= user.name %></p>";

let result = parse(source).unwrap();
result.value;
```
:::

The tree is the same in every binding.

```
@ DocumentNode (location: (1:0)-(1:29))
└── children: (1 item)
    └── @ HTMLElementNode (location: (1:0)-(1:29))
        ├── open_tag:
        │   └── @ HTMLOpenTagNode (location: (1:0)-(1:3))
        │       ├── tag_opening: "<" (location: (1:0)-(1:1))
        │       ├── tag_name: "p" (location: (1:1)-(1:2))
        │       ├── attributes: []
        │       └── tag_closing: ">" (location: (1:2)-(1:3))
        │
        ├── tag_name: "p" (location: (1:1)-(1:2))
        ├── body: (2 items)
        │   ├── @ HTMLTextNode (location: (1:3)-(1:9))
        │   │   └── content: "Hello "
        │   │
        │   └── @ ERBContentNode (location: (1:9)-(1:25))
        │       ├── tag_opening: "<%=" (location: (1:9)-(1:12))
        │       ├── content: " user.name " (location: (1:12)-(1:23))
        │       └── tag_closing: "%>" (location: (1:23)-(1:25))
        │
        ├── close_tag:
        │   └── @ HTMLCloseTagNode (location: (1:25)-(1:29))
        │       ├── tag_opening: "</" (location: (1:25)-(1:27))
        │       ├── tag_name: "p" (location: (1:27)-(1:28))
        │       └── tag_closing: ">" (location: (1:28)-(1:29))
        │
        └── is_void: false
```

Ruby and JavaScript print it with `inspect`, Java with `result.value.inspect()` and Rust with `result.tree_inspect()`.

## Parse a file

Ruby and JavaScript read the file for you.

::: code-group
```ruby [Ruby]
Herb.parse_file("./index.html.erb").value
```

```js [JavaScript]
Herb.parseFile("./index.html.erb").value
```
:::

In Java and Rust, read the file yourself and pass the string to `parse`. The `@herb-tools/browser` package has no file access either, so `parseFile` throws there.

## Options

The most commonly used parser options are the same everywhere.

| Option | Type | Default | Description |
|---|---|---|---|
| `strict` | Boolean | `true` | Report diagnostics for patterns that are valid HTML+ERB but ambiguous for tooling |
| `analyze` | Boolean | `true` | Run the post-parse analysis passes, which are ERB control flow, HTML tag matching and Ruby syntax errors |
| `track_whitespace` | Boolean | `false` | Keep insignificant whitespace in the tree as `WhitespaceNode`s |

::: code-group
```ruby [Ruby]
Herb.parse(source, strict: false, track_whitespace: true)
```

```js [JavaScript]
Herb.parse(source, { strict: false, track_whitespace: true })
```

```java [Java]
import org.herb.ParserOptions;

ParserOptions options = ParserOptions.create().strict(false).trackWhitespace(true);

Herb.parse(source, options);
```

```rust [Rust]
use herb::{parse_with_options, ParserOptions};

let options = ParserOptions { strict: false, track_whitespace: true, ..Default::default() };

parse_with_options(source, &options).unwrap();
```
:::

The options a parse ran with come back on the result, so a caller downstream can ask what it was given instead of guessing.

::: code-group
```ruby [Ruby]
Herb.parse(source).options.strict
```

```js [JavaScript]
Herb.parse(source).options.strict
```

```rust [Rust]
parse(source).unwrap().options.strict
```
:::

[Parser Options](/parser-options) documents every option in full.

## The result

| Member | Holds |
| --- | --- |
| `value` | The `DocumentNode` at the root of the tree |
| `errors` | The errors the parser reported at the top level |
| `source` | The source that was parsed |

Errors also hang off the nodes they belong to, so a tree that parsed with problems can be walked for them.

::: code-group
```ruby [Ruby]
result = Herb.parse(source)

result.failed?
result.value.recursive_errors.each { |error| puts error.message }
```

```js [JavaScript]
const result = Herb.parse(source)

result.failed
result.recursiveErrors().forEach((error) => console.log(error.message))
```

```java [Java]
ParseResult result = Herb.parse(source);

if (result.hasErrors()) {
  for (Node error : result.recursiveErrors()) {
    System.out.println(error.inspect());
  }
}
```

```rust [Rust]
let result = parse(source).unwrap();

if result.failed() {
  for error in result.recursive_errors() {
    println!("{}", error.message());
  }
}
```
:::

`result.errors` holds what the parser reported at the top level. The recursive variants collect the errors from the whole tree, and in Ruby that one lives on the node, as `result.value.recursive_errors`.

## Next

[Working with the tree](/bindings/tree) walks what came back, with visitors and with a position.
