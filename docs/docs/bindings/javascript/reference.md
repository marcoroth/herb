---
outline: deep
---

# JavaScript Reference

The `Herb` object exposes a few methods for you to lex, extract and parse HTML+ERB source code.


:::tip Usage

The API remains the same for both packages regardless of whether you imported `Herb` from `@herb-tools/browser` or `@herb-tools/node`.

:::code-group
```js twoslash [Browser]
import { Herb } from "@herb-tools/browser"

await Herb.load()

Herb.parse("content")
```

```js twoslash [Node.js]
import { Herb } from "@herb-tools/node"

await Herb.load()

Herb.parse("content")
```

<br/>

Learn more on [how to install and load the NPM packages](/bindings/javascript/#installation)

:::

## JavaScript API

`Herb` provides the following key methods:

- **`Herb.lex(source: string): LexResult`**
- **`Herb.lexFile(path: string): LexResult`**
- **`Herb.parse(source: string): ParseResult`**
- **`Herb.parseFile(path: string): ParseResult`**
- **`Herb.extractRuby(source: string, options?: ExtractRubyOptions): string`**
- **`Herb.extractHTML(source: string): string`**
- **`Herb.version: string`**


## Lexing

The `Herb.lex` and `Herb.lexFile` methods allow you to tokenize an HTML document with embedded Ruby.

### `Herb.lex(source)`

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const source = "<p>Hello <%= user.name %></p>"
const result = Herb.lex(source)

console.log(result)
//           ^?
```
:::

<br />

### `Herb.lexFile(path)`

> [!WARNING]
> File operations are not supported in the `@herb-tools/browser` package and will throw an error when called.

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const result = Herb.lexFile("./index.html.erb")

console.log(result)
//           ^?
```
```erb [index.html.erb]
<h1><%= "Hello World" %></h1>
```
:::

## Parsing

The `Herb.parse` and `Herb.parseFile` methods allow you to parse an HTML document with embedded Ruby and returns you a parsed result of your document containing an Abstract Syntax Tree (AST) that you can use to structurally traverse the parsed document.

### `Herb.parse(source)`

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const source = "<p>Hello <%= user.name %></p>"
const result = Herb.parse(source)

console.log(result)
//           ^?
```
:::

<br />

### `Herb.parseFile(path)`

> [!WARNING]
> File operations are not supported in the `@herb-tools/browser` package and will throw an error when called.

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const result = Herb.parseFile("./index.html.erb")

console.log(result)
//           ^?
```
```erb [index.html.erb]
<h1><%= "Hello World" %></h1>
```
:::


## Extracting Code

Herb allows you to extract either Ruby or HTML from mixed content.

### `Herb.extractRuby(source, options?)`

The `Herb.extractRuby` method allows you to extract only the Ruby parts of an HTML document with embedded Ruby.

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const source = "<p>Hello <%= user.name %></p>"

const ruby = Herb.extractRuby(source)

console.log(ruby);
// Outputs: "             user.name  ;    "
```
:::

#### Options

```typescript
interface ExtractRubyOptions {
  semicolons?: boolean        // default: true
  comments?: boolean          // default: false
  preserve_positions?: boolean // default: true
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `semicolons` | `boolean` | `true` | Add ` ;` at the end of each ERB tag to separate statements |
| `comments` | `boolean` | `false` | Include ERB comments (`<%# %>`) in the output |
| `preserve_positions` | `boolean` | `true` | Maintain character positions by padding with whitespace |

#### Examples

**Default behavior** (position-preserving with semicolons):

```js
const source = "<% x = 1 %> <% y = 2 %>"

Herb.extractRuby(source)
// => "   x = 1  ;    y = 2  ;"
```

**Without semicolons:**

```js
Herb.extractRuby(source, { semicolons: false })
// => "   x = 1       y = 2   "
```

**Including ERB comments:**

```js
const source = "<%# comment %>\n<% code %>"

Herb.extractRuby(source, { comments: true })
// => "  # comment   \n   code  ;"
```

**Without position preservation** (readable output, each tag on its own line):

```js
const source = "<%# comment %><%= something %>"

Herb.extractRuby(source, { preserve_positions: false, comments: true })
// => "# comment \n something "
```

> [!TIP]
> Use `preserve_positions: false` when you need readable Ruby output.
> Use `preserve_positions: true` (default) when you need accurate error position mapping.

### `Herb.extractHTML(source)`

The `Herb.extractHTML` method allows you to extract only the HTML parts of an HTML document with embedded Ruby.

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
const source = "<p>Hello <%= user.name %></p>"

const html = Herb.extractHTML(source)

console.log(html)
// Outputs: "<p>Hello                 </p>"
```
:::

## AST Traversal

Herb supports AST traversal using visitors.

### Visitors

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
import { Visitor } from "@herb-tools/node"
// import { Visitor } from "@herb-tools/browser"

class TextNodeVisitor extends Visitor {
  visitHTMLTextNode(node) {
    console.log("HTML TextNode", node.content);
  }
}

const visitor = new TextNodeVisitor()
const result = Herb.parse("<p>Hello <%= user.name %></p>")

result.visit(visitor)
```
:::

This allows you to analyze the parsed HTML+ERB programmatically.


## Metadata

### `Herb.version`

:::code-group
```js twoslash [javascript]
import { Herb } from "@herb-tools/node"

// ---cut---
console.log(Herb.version)
// => "@herb-tools/node@0.0.1, @herb-tools/core@0.0.1, libherb@0.0.1 (Node.js C++ native extension)"
```
:::
