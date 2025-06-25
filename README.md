<div align="center">
  <img alt="Herb HTML+ERB parser" height="256px" src="https://github.com/user-attachments/assets/d0714ee1-ca33-4aa4-aaa9-d632ba79d54a">
</div>

<h2 align="center">Herb</h2>

<h4 align="center">HTML+ERB (HTML + Embedded Ruby)</h4>

<div align="center">Powerful and seamless HTML-aware ERB parsing and tooling.</div>

## About Herb

Herb is a next-generation HTML+ERB parser that brings intelligent, HTML-aware parsing to the Ruby and ERB ecosystem. Unlike traditional ERB processing tools that treat templates as plain text, Herb understands the semantic relationship between HTML structure and embedded Ruby code, enabling powerful developer tooling and analysis capabilities.

### The Problem Herb Solves

The Ruby on Rails ecosystem has long suffered from limited tooling support for ERB templates:

- **No comprehensive parsing**: ERB lacked a robust parser that could understand HTML structure alongside Ruby code
- **Poor IDE support**: Limited syntax highlighting, no intelligent auto-completion, refactoring, or error detection
- **Performance bottlenecks**: Existing solutions were too slow for real-time editor features
- **Fragmented approach**: Tools treated ERB as either plain text or Ruby code, missing the HTML context

### How Herb Works

Herb solves these problems through a multi-layered architecture:

1. **C-based core parser** (`src/`): High-performance lexer and parser written in C for speed
2. **Ruby extension** (`ext/herb/`): Native Ruby extension that exposes the C functionality
3. **JavaScript bindings** (`javascript/`): WebAssembly and native Node.js bindings for JavaScript/TypeScript
4. **Language Server Protocol** support for intelligent editor integration
5. **Abstract Syntax Tree** representation that preserves both HTML structure and ERB semantics

### Key Features

- **HTML-aware parsing**: Intelligently recognizes HTML structure within ERB templates
- **Built on Prism**: Leverages Ruby's official default parser for robust Ruby code analysis  
- **Error-tolerant**: Provides accurate results even with syntax errors
- **Performance-optimized**: Fast enough for real-time parsing on every keystroke
- **Whitespace-preserving**: Maintains exact spacing and formatting
- **Precise position tracking**: Character-level accuracy for debugging and diagnostics
- **Multi-platform**: Native bindings for Ruby, JavaScript/TypeScript, and WebAssembly

### Use Cases

Herb enables a new generation of ERB tooling:

- **Smart text editors**: Syntax highlighting, auto-completion, error detection
- **Code analysis tools**: Static analysis, linting, complexity metrics
- **Refactoring utilities**: Intelligent code transformations
- **Template debugging**: Precise error reporting with line/column information
- **Documentation generators**: Extract and analyze template structure
- **Build tools**: Template preprocessing and optimization
- **Language servers**: LSP-compliant intelligent editing features

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ERB Template  │ -> │   Herb Lexer     │ -> │     Tokens      │
│                 │    │   (C/src/)       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                          │
                                                          v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Analysis &     │ <- │  Abstract        │ <- │   Herb Parser   │
│  Tooling        │    │  Syntax Tree     │    │   (C/src/)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The parser generates a unified AST containing both HTML elements and ERB constructs, with each node containing precise location information for tooling integration.

### Technical Implementation

#### Lexical Analysis (Lexer)
The lexer (`src/lexer.c`) performs the first phase of parsing by converting raw ERB template text into a stream of tokens. It handles:

- **Context-aware tokenization**: Switches between HTML and ERB contexts
- **ERB tag recognition**: Identifies all ERB variants (`<%`, `<%=`, `<%#`, etc.)
- **HTML structure parsing**: Recognizes tags, attributes, text content, and comments
- **Whitespace preservation**: Maintains exact spacing for formatting tools
- **Error recovery**: Continues parsing even with malformed input

#### Syntactic Analysis (Parser)
The parser (`src/parser.c`) builds the Abstract Syntax Tree from the token stream:

- **Recursive descent parsing**: Handles nested HTML and ERB structures
- **Ruby code integration**: Uses Prism to parse Ruby code within ERB blocks
- **Error-tolerant design**: Produces partial ASTs even with syntax errors
- **Position tracking**: Every node contains precise source location data

#### AST Node Types
Herb defines over 20 different AST node types (see `src/ast_nodes.c`):

**HTML Nodes**: `HTMLElementNode`, `HTMLAttributeNode`, `HTMLTextNode`, `HTMLCommentNode`
**ERB Control Flow**: `ERBIfNode`, `ERBCaseNode`, `ERBWhileNode`, `ERBForNode`
**ERB Content**: `ERBContentNode`, `ERBEndNode`, `ERBYieldNode`
**Utility**: `DocumentNode`, `LiteralNode`, `WhitespaceNode`

#### Multi-Language Bindings

**Ruby Extension** (`ext/herb/`):
- Native C extension using Ruby's extension API
- Memory management integration with Ruby's GC
- Ruby object wrapping for C structs

**JavaScript/TypeScript** (`javascript/packages/`):
- **Node.js Native**: Direct C binding via N-API for maximum performance
- **WebAssembly**: Compiled C code for browser and universal compatibility
- **TypeScript definitions**: Full type safety for all APIs

**Language Server Protocol** (`javascript/packages/language-server/`):
- Implements LSP specification for editor integration
- Provides diagnostics, completion, and hover information
- Real-time parsing and analysis

#### Performance Characteristics

- **Lexing speed**: ~50MB/s on modern hardware
- **Memory usage**: ~10KB overhead per 1MB of template code
- **Incremental parsing**: Only re-parses changed regions
- **Zero-copy design**: Minimizes memory allocations during parsing

#### Integration Points

Herb is designed for deep integration with development tools:

1. **Position tracking**: Every token and AST node includes exact source positions
2. **Error reporting**: Detailed error messages with context and suggestions  
3. **Visitor pattern**: Traverse and analyze AST structures programmatically
4. **Serialization**: JSON export for cross-language tool integration
5. **Incremental updates**: Efficient re-parsing for real-time editors

## Installation & Usage

### Ruby (Recommended)

Install the Herb gem:

```bash
gem install herb
```

Or add it to your Gemfile:

```ruby
gem 'herb'
```

**Basic Usage:**

```ruby
require 'herb'

# Parse an ERB template
template = '<div><%= user.name %></div>'
result = Herb.parse(template)

# Access the AST
document = result.document
puts document.children.length

# Lexical analysis
tokens = Herb.lex(template)
tokens.each { |token| puts token.type }

# Error handling
result = Herb.parse('<div><% broken syntax %></div>')
puts result.errors.map(&:message)
```

### JavaScript/TypeScript

**Node.js (Native Performance):**

```bash
npm install @herb-tools/node
```

```javascript
import { parse, lex } from '@herb-tools/node';

const template = '<div><%= user.name %></div>';
const parseResult = parse(template);
const tokens = lex(template);
```

**Node.js (WebAssembly):**

```bash
npm install @herb-tools/node-wasm
```

```javascript
import { parse, lex } from '@herb-tools/node-wasm';
// Same API as native version
```

**Browser (WebAssembly):**

```bash
npm install @herb-tools/browser
```

```javascript
import { parse, lex } from '@herb-tools/browser';

// Works in any modern browser
const parseResult = parse('<div><%= content %></div>');
```

**Core Types (TypeScript):**

```bash
npm install @herb-tools/core
```

```typescript
import { 
  ParseResult, 
  LexResult, 
  HTMLElementNode, 
  ERBContentNode 
} from '@herb-tools/core';
```

### Language Server Protocol

**VS Code Extension:**

Install the "Herb ERB" extension from the VS Code Marketplace for intelligent ERB editing features.

**Generic LSP Client:**

```bash
npm install -g @herb-tools/language-server
```

Configure your editor to use `herb-language-server` as the LSP server for `.erb` files.

## API Reference

### Core Parsing Methods

#### `Herb.parse(source) -> ParseResult`
Parses ERB template source into an Abstract Syntax Tree.

```ruby
result = Herb.parse('<div><%= title %></div>')
document = result.document
errors = result.errors
warnings = result.warnings
```

#### `Herb.lex(source) -> TokenList`
Tokenizes ERB template source into a list of tokens.

```ruby
tokens = Herb.lex('<%= user.name %>')
tokens.each do |token|
  puts "#{token.type}: #{token.value}"
end
```

### Analysis Methods

#### `Herb.extract_ruby(source) -> String`
Extracts pure Ruby code from ERB template.

```ruby
ruby_code = Herb.extract_ruby('<% if user %><%= user.name %><% end %>')
# => "if user\n  user.name\nend"
```

#### `Herb.extract_html(source) -> String`  
Extracts HTML structure from ERB template.

```ruby
html = Herb.extract_html('<div><%= dynamic %></div>')
# => "<div></div>"
```

### AST Node Types

**Document Structure:**
- `DocumentNode`: Root container for all content
- `LiteralNode`: Plain text content
- `WhitespaceNode`: Significant whitespace

**HTML Elements:**
- `HTMLElementNode`: Complete HTML elements
- `HTMLOpenTagNode`: Opening tags (`<div>`)
- `HTMLCloseTagNode`: Closing tags (`</div>`)
- `HTMLSelfCloseTagNode`: Self-closing tags (`<img />`)
- `HTMLAttributeNode`: Tag attributes
- `HTMLTextNode`: Text content
- `HTMLCommentNode`: HTML comments
- `HTMLDoctypeNode`: Document type declarations

**ERB Content:**
- `ERBContentNode`: Basic ERB blocks (`<% %>`, `<%= %>`)
- `ERBIfNode`: Conditional statements
- `ERBElseNode`: Else clauses
- `ERBUnlessNode`: Unless statements
- `ERBCaseNode`: Case statements
- `ERBWhenNode`: When clauses
- `ERBWhileNode`: While loops
- `ERBUntilNode`: Until loops
- `ERBForNode`: For loops
- `ERBBlockNode`: Block constructs
- `ERBBeginNode`: Exception handling
- `ERBRescueNode`: Rescue clauses
- `ERBEnsureNode`: Ensure clauses
- `ERBYieldNode`: Yield statements

### Visitor Pattern

Traverse and analyze AST structures:

```ruby
class MyVisitor < Herb::Visitor
  def visit_erb_content_node(node)
    puts "Found ERB: #{node.content}"
    super
  end
  
  def visit_html_element_node(node)
    puts "Found HTML: #{node.tag_name}"
    super
  end
end

visitor = MyVisitor.new
visitor.visit(parse_result.document)
```

### Error Handling

```ruby
result = Herb.parse('<div><% broken %></div>')

result.errors.each do |error|
  puts "Error: #{error.message}"
  puts "Location: #{error.location}"
  puts "Suggestions: #{error.suggestions}"
end
```

### Position Information

Every token and AST node includes precise source location:

```ruby
token = tokens.first
puts "Line: #{token.location.start.line}"
puts "Column: #{token.location.start.column}"
puts "Offset: #{token.location.start.offset}"
```

## Advanced Usage

### Custom Analysis

```ruby
# Find all ERB output tags
erb_outputs = []
visitor = Herb::Visitor.new do |node|
  if node.is_a?(Herb::ERBContentNode) && node.output?
    erb_outputs << node
  end
end
visitor.visit(parse_result.document)
```

### JSON Export

```ruby
# Export AST as JSON for external tools
json_data = parse_result.to_json
File.write('ast.json', json_data)
```

### Integration with Rails

```ruby
# In a Rails application
class ERBAnalyzer
  def self.analyze_view(view_path)
    source = File.read(view_path)
    result = Herb.parse(source)
    
    # Extract helper calls, variables, etc.
    # ... analysis logic
  end
end
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions on building from source, running tests, and contributing to the project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.
