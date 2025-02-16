---
outline: deep
---

# `ERBX` Reference

The `ERBX` module exposes a few methods for you to lex, extract and parse HTML+ERB source code.

## Ruby API

* `ERBX.lex(source)` - tokenizes a document.
* `ERBX.extract_ruby(source)` - extracts only the Ruby parts of a document.
* `ERBX.extract_html(source)` - extracts only the HTML parts of a document.
* `ERBX.parse(source)` - parses the document and returns it within a parse result.

## Lexing

### `ERBX.lex(source)`

The `ERBX.lex` method allows you to tokenize an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

ERBX.lex(code)
# => [TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_NAME, TOKEN_HTML_TAG_END, ...]
```


## Extracting Code

### `ERBX.extract_ruby(source)`

The `ERBX.extract_ruby` method allows you to extract only the Ruby parts of an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

ERBX.extract_ruby(code)
# => "        "Hello World"        "
```

### `ERBX.extract_html(source)`

The `ERBX.extract_html` method allows you to extract only the HTML parts of an HTML document with embedded Ruby (ERB).

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

ERBX.extract_html(code)
# => "<h1>                    </h1>"
```

## Parsing

### `ERBX.parse(source)`

The `ERBX.parse` method allows you to parse an HTML document with embedded Ruby (ERB) and returns you a parsed result of your document containing an Abstract Syntax Tree (AST) that you can use to structurally traverse the parsed document.

```ruby
code = <<~HTML
  <h1><%= "Hello World" %></h1>
HTML

ERBX.parse(code)
# => #<ERBX::ParseResult ...>"
```

## AST Traversal

### Visitors

::: info TODO
Add example to traverse the AST using a Visitor
:::
