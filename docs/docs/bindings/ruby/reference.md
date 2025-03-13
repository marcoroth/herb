---
outline: deep
---

# Ruby Reference

The `Herb` module exposes a few methods for you to lex, extract and parse HTML+ERB source code.

## Ruby API

`Herb` provides the following key methods:

* `Herb.lex(source)`
* `Herb.lex_file(path)`
* `Herb.parse(source)`
* `Herb.parse_file(path)`
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

### `Herb.parse(source)`

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

### `Herb.parse_file(path)`

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

### `Herb.extract_ruby(source)`

The `Herb.extract_ruby` method allows you to extract only the Ruby parts of an HTML document with embedded Ruby.

:::code-group
```ruby
source = %(<p>Hello <%= user.name %></p>)

Herb.extract_ruby(source)
# => "             user.name       "
```
:::

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

## Metadata

### `Herb.version`

:::code-group
```ruby
Herb.version
# => "herb gem v0.0.1, libherb v0.0.1 (Ruby C native extension)"
```
:::
