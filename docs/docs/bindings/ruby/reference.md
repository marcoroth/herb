---
outline: deep
---

# Ruby Reference

The `Herb` module exposes a few methods for you to lex, extract and parse HTML+ERB source code.

## Ruby API

`Herb` provides the following key methods:

* `Herb.lex(source)`
* `Herb.lex_file(path)`
* `Herb.parse(source, **options)`
* `Herb.parse_file(path, **options)`
* `Herb.extract_ruby(source)`
* `Herb.extract_html(source)`
* `Herb.version`

## Lexing

The `Herb.lex` and `Herb.lex_file` methods allow you to tokenize an HTML document with embedded Ruby.

### `Herb.lex(source)`

:::code-group
```ruby
source = %(<p>Hello <%= user.name %></p>)

Herb.lex(source).value
# [
#   <Herb::Token type="TOKEN_HTML_TAG_START" value="<" ... >,
#   <Herb::Token type="TOKEN_IDENTIFIER" value="h1"... >,
#   ...
#   <Herb::Token type="TOKEN_EOF" value=""... >,
# ]
```
:::

### `Herb.lex_file(path)`

:::code-group
```ruby
Herb.lex_file("./index.html.erb").value
# [
#   <Herb::Token type="TOKEN_HTML_TAG_START" value="<" ... >,
#   <Herb::Token type="TOKEN_IDENTIFIER" value="h1"... >,
#   ...
#   <Herb::Token type="TOKEN_EOF" value=""... >,
# ]
```
```erb [index.html.erb]
<h1><%= "Hello World" %></h1>
```
:::


## Parsing

The `Herb.parse` and `Herb.parse_file` methods allow you to parse an HTML document with embedded Ruby and returns you a parsed result of your document containing an Abstract Syntax Tree (AST) that you can use to structurally traverse the parsed document.

### `Herb.parse(source, **options)`

:::code-group
```ruby
source = %(<p>Hello <%= user.name %></p>)

Herb.parse(source).value
# =>
# @ DocumentNode (location: (1:0)-(1:29))
# └── children: (1 item)
#     └── @ HTMLElementNode (location: (1:0)-(1:29))
#         ├── open_tag:
#         │   └── @ HTMLOpenTagNode (location: (1:0)-(1:3))
#         │       ├── tag_opening: "<" (location: (1:0)-(1:1))
#         │       ├── tag_name: "p" (location: (1:1)-(1:2))
#         │       ├── attributes: []
#         │       ├── tag_closing: ">" (location: (1:2)-(1:3))
#         │       ├── children: []
#         │       └── is_void: false
#         │
#         ├── tag_name: "p" (location: (1:1)-(1:2))
#         ├── body: (2 items)
#         │   ├── @ HTMLTextNode (location: (1:3)-(1:9))
#         │   │   └── content: "Hello "
#         │   │
#         │   └── @ ERBContentNode (location: (1:9)-(1:25))
#         │       ├── tag_opening: "<%=" (location: (1:9)-(1:12))
#         │       ├── content: " user.name " (location: (1:12)-(1:23))
#         │       └── tag_closing: "%>" (location: (1:23)-(1:25))
#         │
#         ├── close_tag:
#         │   └── @ HTMLCloseTagNode (location: (1:25)-(1:29))
#         │       ├── tag_opening: "</" (location: (1:25)-(1:27))
#         │       ├── tag_name: "p" (location: (1:27)-(1:28))
#         │       └── tag_closing: ">" (location: (1:28)-(1:29))
#         │
#         └── is_void: false
```
:::

#### Options

The most commonly used parser options are:

| Option             | Type      | Default | Description                                                                                            |
|--------------------|-----------|---------|--------------------------------------------------------------------------------------------------------|
| `strict`           | `Boolean` | `true`  | Report diagnostics for patterns that are valid HTML+ERB but ambiguous for tooling                      |
| `analyze`          | `Boolean` | `true`  | Run the post-parse analysis passes (ERB control-flow structure, HTML tag matching, Ruby syntax errors) |
| `track_whitespace` | `Boolean` | `false` | Keep insignificant whitespace in the syntax tree as `WhitespaceNode`s                                  |

```ruby
Herb.parse(source, strict: false, track_whitespace: true)
```

The options used for a parse are available on the result:

```ruby
Herb.parse(source).options.strict
# => true
```

See [Parser Options](/parser-options) for the full list and detailed descriptions.

### `Herb.parse_file(path, **options)`

:::code-group
```ruby
Herb.parse_file("./index.html.erb").value
# =>
# @ DocumentNode (location: (1:0)-(1:29))
# └── children: (1 item)
#     └── [...]
```

```erb [index.html.erb]
<h1><%= "Hello World" %></h1>
```
:::

## Extracting Code

### `Herb.extract_ruby(source, **options)`

The `Herb.extract_ruby` method allows you to extract only the Ruby parts of an HTML document with embedded Ruby.

:::code-group
```ruby
source = %(<p>Hello <%= user.name %></p>)

Herb.extract_ruby(source)
# => "             user.name  ;    "
```
:::

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `semicolons` | `Boolean` | `true` | Add ` ;` at the end of each ERB tag to separate statements |
| `comments` | `Boolean` | `false` | Include ERB comments (`<%# %>`) in the output |
| `preserve_positions` | `Boolean` | `true` | Maintain character positions by padding with whitespace |

#### Examples

**Default behavior** (position-preserving with semicolons):

```ruby
source = "<% x = 1 %> <% y = 2 %>"

Herb.extract_ruby(source)
# => "   x = 1  ;    y = 2  ;"
```

**Without semicolons:**

```ruby
Herb.extract_ruby(source, semicolons: false)
# => "   x = 1       y = 2   "
```

**Including ERB comments:**

```ruby
source = "<%# comment %>\n<% code %>"

Herb.extract_ruby(source, comments: true)
# => "  # comment   \n   code  ;"
```

**Without position preservation** (readable output, each tag on its own line):

```ruby
source = "<%# comment %><%= something %>"

Herb.extract_ruby(source, preserve_positions: false, comments: true)
# => "# comment \n something "
```

> [!TIP]
> Use `preserve_positions: false` when you need readable Ruby output.
> Use `preserve_positions: true` (default) when you need accurate error position mapping.

### `Herb.extract_html(source)`

The `Herb.extract_html` method allows you to extract only the HTML parts of an HTML document with embedded Ruby.

:::code-group
```ruby
source = %(<p>Hello <%= user.name %></p>)

Herb.extract_html(source)
# => "<p>Hello                 </p>"
```
:::

## AST Traversal

### Visitors

Herb supports AST traversal using visitors.

:::code-group
```ruby
class TextNodeVisitor < Herb::Visitor
  def visit_html_text_node(node)
    puts "HTML TextNode #{node.content}"
  end
end

visitor = TextNodeVisitor.new

result = Herb.parse("<p>Hello <%= user.name %></p>")
result.visit(visitor)
```
:::

This allows you to analyze the parsed HTML+ERB programmatically.

### Locating a node

Finds the most specific node at a position, and the nodes it sits inside. A position that comes back from a rendered page, an editor, or a diagnostic is a node before it is anything anyone can act on, and this is what turns one into the other.

A node's location contains its start and stops short of its end, so two nodes sitting next to each other never both answer for the character between them. A node with no location of its own answers for nothing, which keeps a synthesized node from swallowing the position of the node it was built next to. A position outside everything the given node covers belongs to no node.

Ancestors read nearest first, so the enclosing element a caller wants is the first one that answers.

Columns are 0-based character offsets into their line, which is what the parser reports.

:::code-group
```ruby
result = Herb.parse("<div><span>hi</span></div>")
found = Herb::Locate.call(result.value, Herb::Position[1, 12])

found.node
# => #<Herb::AST::HTMLTextNode>

found.ancestors.map(&:class)
# => [Herb::AST::HTMLElementNode, Herb::AST::HTMLElementNode, Herb::AST::DocumentNode]

found.innermost(Herb::AST::HTMLElementNode).tag_name.value
# => "span"

found.path.map(&:class)
# => [Herb::AST::DocumentNode, ..., Herb::AST::HTMLTextNode]
```
:::

`innermost` starts with the node itself, so it answers with the node when the node is already of that kind. `path` reads the other way around, outermost first, and ends with the node that was found. A position that belongs to no node answers `nil`.

A parse result answers for the document it parsed, so the result a caller already has can be handed over directly. ``Herb::Locate.locatable?`` asks the same question without walking, and answers whether a position falls anywhere inside a node or what it holds.

The walk goes by how much source a node and everything it holds cover together, which is not the same as the node's own location. A branch of an `if` holds the branch after it, and each branch is positioned where it was written, so the node holding the chain ends before what it holds. Walking by a node's own location would leave every branch but the first unreachable. `ancestors` is therefore the walk that was taken, whether or not each node along it covers the position itself, and a caller that wants only the nodes the position is really inside filters on `location.contains?`.

The positions this reads come from `Herb::Location#contains?`, `Herb::Location#covers?` and `Herb::Position`, which orders the way it reads through `Comparable`.

## Metadata

### `Herb.version`

:::code-group
```ruby
Herb.version
# => "herb gem v0.0.1, libherb v0.0.1 (Ruby C native extension)"
```
:::
