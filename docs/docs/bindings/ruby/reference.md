---
outline: deep
---

# Ruby Reference

The `Herb` module provides a comprehensive API for lexing, parsing, formatting, linting, and printing HTML+ERB source code across multiple backend engines.

## Core API Methods

### Parsing & Lexing
* `Herb.lex(source, backend: nil)`
* `Herb.lex_file(path, backend: nil)`
* `Herb.parse(source, backend: nil)`
* `Herb.parse_file(path, backend: nil)`

### Formatting & Linting
* `Herb.format(source, backend: :node)`
* `Herb.format_file(path, backend: :node)`
* `Herb.lint(source, backend: :node)`
* `Herb.lint_file(path, backend: :node)`

### Code Extraction
* `Herb.extract_ruby(source)`
* `Herb.extract_html(source)`

### Node Printing
* `Herb.print_node(node, backend: :node)`

### Backend Management
* `Herb.switch_backend(backend_name)`
* `Herb.current_backend`
* `Herb.available_backends`
* `Herb.backend(backend_name)`

### System Information
* `Herb.version`

## Lexing

The `Herb.lex` and `Herb.lex_file` methods allow you to tokenize an HTML document with embedded Ruby.

### `Herb.lex(source, backend: nil)`

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

### `Herb.lex_file(path, backend: nil)`

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

### Basic Example

:::code-group
```ruby
require "herb"

source = %(<div>Hello <%= user.name %>!</div>)
result = Herb.parse(source)

if result.success?
  puts result.value.class  # => Herb::AST::DocumentNode
else
  puts "Parse errors: #{result.errors}"
end
```
:::

### `Herb.parse(source, backend: nil)`

:::code-group
```ruby
source = %(<div>Hello <%= user.name %>!</div>)

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

### `Herb.parse_file(path, backend: nil)`

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

## Formatting

Herb provides advanced formatting capabilities through the Node backend using the `@herb-tools/formatter` package.

> [!NOTE] Default Backend
> Format operations default to the Node backend since it's the only backend that supports formatting. You can override this by specifying a different backend.

### Basic Example

:::code-group
```ruby
require "herb"

# Messy ERB template
messy_erb = '<div><span>Hello</span><span><%= user.name %></span></div>'

# Format with default options
formatted = Herb.format(messy_erb)
puts formatted
# =>
# <div>
#   <span>Hello</span>
#   <span><%= user.name %></span>
# </div>
```
:::

### `Herb.format(source, backend: :node, **options)`

:::code-group
```ruby
# Format messy ERB template
source = %(<div><div><span>Hello</span><span><%=user.name%></span></div></div><%if active%><div id="active">Active</div><%else%>Inactive<%end%>)

formatted = Herb.format(source)

puts formatted
# =>
# <div>
#   <div><span>Hello</span><span><%= user.name %></span></div>
# </div>
#
# <% if active %>
#   <div id="active">Active</div>
# <% else %>
#   Inactive
# <% end %>
```
:::

### `Herb.format_file(path, backend: :node, **options)`

:::code-group
```ruby
# Format an ERB file
formatted = Herb.format_file("./template.html.erb", backend: :node)
File.write("./formatted_template.html.erb", formatted)
```
:::

## Linting

Herb provides comprehensive linting capabilities through the Node backend using the `@herb-tools/linter` package.

> [!NOTE] Default Backend
> Lint operations default to the Node backend since it's the only backend that supports linting. You can override this by specifying a different backend.

### Basic Example

:::code-group
```ruby
require "herb"

template = %(<img src="photo.jpg"><div class='container'>Content</div>)

lint_result = Herb.lint(template)

if lint_result.success?
  puts "✓ No lint issues found"
else
  puts "Found #{lint_result.total_offenses} issues:"

  lint_result.error_offenses.each do |offense|
    puts "  Error: #{offense.message} (#{offense.rule})"
  end

  lint_result.warning_offenses.each do |offense|
    puts "  Warning: #{offense.message} (#{offense.rule})"
  end
end
```
:::

### `Herb.lint(source, backend: :node, **options)`

:::code-group
```ruby
# Lint ERB template
source = %(<img src="photo.jpg"><div class='container'>Content</div>)

lint_result = Herb.lint(source)

if lint_result.success?
  puts "✓ No lint issues found"
else
  puts "Found #{lint_result.total_offenses} issues:"

  lint_result.error_offenses.each do |offense|
    puts "  Error: #{offense.message} (#{offense.rule})"
  end

  lint_result.warning_offenses.each do |offense|
    puts "  Warning: #{offense.message} (#{offense.rule})"
  end
end
```
:::

### `Herb.lint_file(path, backend: :node, **options)`

:::code-group
```ruby
# Lint an ERB file
lint_result = Herb.lint_file("./template.html.erb", backend: :node)

# Generate a report
if !lint_result.clean?
  puts lint_result.to_s
  # => "✗ Found 3 lint offenses: 1 errors, 2 warnings"
end
```
:::

## Node Printing

Convert AST nodes back to ERB/HTML strings with optional formatting.

> [!NOTE] Default Backend
> Print operations default to the Node backend since it's the only backend that supports node printing. You can override this by specifying a different backend.

### Basic Example

:::code-group
```ruby
require "herb"

source = %(<div>Hello <%= user.name %>!</div>)
result = Herb.parse(source)

if result.success?
  node = result.value

  formatted = node.to_source                 # Uses FormatPrinter
  original  = node.to_source(format: false)  # Uses IdentityPrinter

  puts formatted
end
```
:::

### Node Methods

Every AST node supports these methods:

#### `node.to_source(backend: :node, format: true, **options)`

:::code-group
```ruby
result = Herb.parse("<div>Hello <%= user.name %>!</div>")

result.value.to_source
# => "<div>Hello <%= user.name %>!</div>"
```
:::

## Backend Management

Herb supports multiple backend engines with different capabilities:

### Available Backends

- **Native Backend** - Ruby C extension (default)
  - ✓ Parsing, Lexing, Code Extraction
  - ✗ Formatting, Linting, Node Printing

- **Node Backend** - Node.js integration with full feature set
  - ✓ All features including formatting, linting, and printing
  - Requires `nodo` gem and Node.js packages

- **FFI Backend** - Foreign Function Interface (not yet implemented)
  - 🚧 Planned for future release
  - Will provide direct access to libherb via FFI

- **WASM Backend** - WebAssembly (not yet implemented)
  - 🚧 Planned for future release
  - Will enable browser and sandboxed environments

### Backend Selection

#### `Herb.switch_backend(backend_name)`

:::code-group
```ruby
# Switch to native backend (no dependencies)
Herb.switch_backend(:native)

# Switch to node backend (all features)
Herb.switch_backend(:node)

Herb.current_backend  # => "node"
```
:::

#### `Herb.available_backends`

:::code-group
```ruby
Herb.available_backends
# => [:native, :node]
```
:::

#### Cross-Backend Operations

:::code-group
```ruby
# Keep native backend for fast parsing
Herb.switch_backend(:native)

# Parse with current (native) backend
result = Herb.parse(source)

# Format with Node backend without switching
formatted = Herb.format(source)

# Lint with Node backend
lint_result = Herb.lint(source)

# Print node
html_output = result.value.to_source(format: true)
html_output = result.value.to_source(format: false)

Herb.current_backend # => "native"
```
:::

## LintResult API

The `Herb::LintResult` class provides detailed information about linting results:

### Properties

:::code-group
```ruby
lint_result = Herb.lint(template, backend: :node)

# Offense counts
lint_result.total_offenses  # => 5
lint_result.errors          # => 2
lint_result.warnings        # => 2
lint_result.infos           # => 1
lint_result.hints           # => 0

# Status checks
lint_result.success?       # => false (has errors)
lint_result.clean?         # => false (has any offenses)

# Access offenses by severity
lint_result.error_offenses   # => [LintOffense, ...]
lint_result.warning_offenses # => [LintOffense, ...]
lint_result.info_offenses    # => [LintOffense, ...]

# Access offenses by rule
lint_result.offenses_for_rule("html-img-require-alt")  # => [LintOffense, ...]
```
:::

### Output Formats

:::code-group
```ruby
lint_result = Herb.lint(template, backend: :node)

# String representation
puts lint_result.to_s
# => "✗ Found 3 lint offenses: 2 errors, 1 warnings"

# Hash representation
hash = lint_result.to_h
# => { offenses: [...], errors: 2, warnings: 1, success: false }

# JSON representation
json = lint_result.to_json
# => '{"offenses":[...],"errors":2,"warnings":1}'
```
:::

### LintOffense API

Each lint offense provides detailed information:

:::code-group
```ruby
offense = lint_result.error_offenses.first

offense.message    # => "Missing alt attribute"
offense.rule       # => "html-img-require-alt"
offense.severity   # => "error"
offense.code       # => "E001"
offense.source     # => "Herb Linter"

# Location information
offense.location.start.line    # => 1
offense.location.start.column  # => 5
offense.location.end.line      # => 1
offense.location.end.column    # => 20

# Severity checks
offense.error?     # => true
offense.warning?   # => false
offense.info?      # => false
offense.hint?      # => false
```
:::

## System Information

### `Herb.version`

:::code-group
```ruby
Herb.version
# => "Herb gem 0.6.0 - Herb::Backends::NativeBackend(native backend v0.6.0 via C extension)"
```
:::
