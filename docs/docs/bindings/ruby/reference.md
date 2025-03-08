---
outline: deep
---

# `Herb` Reference

The `Herb` module exposes a few methods for you to lex, extract and parse HTML+ERB source code.

## Ruby API

* `Herb.lex(source)` - tokenizes a document.
* `Herb.extract_ruby(source)` - extracts only the Ruby parts of a document.
* `Herb.extract_html(source)` - extracts only the HTML parts of a document.
* `Herb.parse(source)` - parses the document and returns it within a parse result.

## Lexing

### `Herb.lex(source)`

The `Herb.lex` method allows you to tokenize an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

Herb.lex(code)
# => [TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_NAME, TOKEN_HTML_TAG_END, ...]
```


## Extracting Code

### `Herb.extract_ruby(source)`

The `Herb.extract_ruby` method allows you to extract only the Ruby parts of an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

Herb.extract_ruby(code)
# => "        "Hello World"        "
```

### `Herb.extract_html(source)`

The `Herb.extract_html` method allows you to extract only the HTML parts of an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

Herb.extract_html(code)
# => "<h1>                    </h1>"
```

## Parsing

### `Herb.parse(source)`

The `Herb.parse` method allows you to parse an HTML document with embedded Ruby (ERB) and returns you a parsed result of your document containing an Abstract Syntax Tree (AST) that you can use to structurally traverse the parsed document.

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

Herb.parse(code)
# => #<Herb::ParseResult ...>"
```

## AST Traversal

### Visitors

::: info TODO
Add example to traverse the AST using a Visitor
:::
