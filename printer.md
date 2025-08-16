

------






# Printer

AST-to-source code conversion for the Herb ecosystem.

## Status
**In Development** - Core functionality available

## Overview

The Herb Printer converts Herb AST nodes back into source code, enabling tools like the formatter and minifier to reconstruct templates after transformation. It provides fine-grained control over output formatting and serves as the foundation for code generation workflows.

## Features

### AST Reconstruction
- **Complete fidelity**: Reconstructs exact source code from AST
- **Configurable formatting**: Control indentation, spacing, and line breaks
- **Comment preservation**: Maintains comments with position information
- **Error handling**: Graceful handling of malformed AST nodes

### Output Customization
- **Indentation styles**: Spaces, tabs, custom patterns
- **Line ending control**: LF, CRLF, or system default
- **Whitespace handling**: Configurable whitespace preservation
- **ERB tag formatting**: Control ERB tag spacing and style

### Source Map Generation
- **Position mapping**: Maps output positions back to original AST nodes
- **Debugging support**: Enables source-level debugging of generated code
- **Tool integration**: Compatible with development tools and debuggers

## Installation

```bash
npm install @herb-tools/printer
```

For Ruby:
```bash
gem install herb-printer
```

## Usage

### JavaScript/Node.js

```javascript
import { Printer } from '@herb-tools/printer'
import { Herb } from '@herb-tools/node'

// Parse template to AST
const ast = Herb.parse('<div><%= @user.name %></div>')

// Create printer with custom formatting
const printer = new Printer({
  indentSize: 2,
  indentType: 'space',
  lineEnding: '\n',
  preserveWhitespace: true
})

// Convert AST back to source
const source = printer.print(ast)
console.log(source)
// <div><%= @user.name %></div>
```

### Advanced Configuration

```javascript
const printer = new Printer({
  // Indentation
  indentSize: 2,
  indentType: 'space', // 'space', 'tab', 'mixed'

  // Line handling
  lineEnding: '\n', // '\n', '\r\n', 'auto'
  maxLineLength: 80,
  wrapLongLines: true,

  // ERB formatting
  erbTagSpacing: 'compact', // 'compact', 'spaced', 'preserve'
  erbOutputPadding: true,

  // HTML formatting
  htmlAttributeWrap: 'auto', // 'auto', 'force', 'never'
  htmlSelfClosing: 'xml', // 'xml', 'html', 'preserve'

  // Comment handling
  preserveComments: true,
  commentIndentation: 'align',

  // Source maps
  generateSourceMap: true,
  sourceMapMode: 'inline' // 'inline', 'external', 'comment'
})
```

### Ruby API

```ruby
require 'herb/printer'

# Parse template
ast = Herb.parse('<div><%= @user.name %></div>')

# Create printer
printer = Herb::Printer.new(
  indent_size: 2,
  indent_type: :space,
  erb_tag_spacing: :compact
)

# Generate source code
source = printer.print(ast)
puts source
```

## Formatting Styles

### ERB Tag Styles

```javascript
// Compact style (default)
printer.setOption('erbTagSpacing', 'compact')
// Output: <%=@user.name%>

// Spaced style
printer.setOption('erbTagSpacing', 'spaced')
// Output: <%= @user.name %>

// Preserve original
printer.setOption('erbTagSpacing', 'preserve')
// Output: (maintains original spacing)
```

### HTML Attribute Formatting

```javascript
const ast = Herb.parse('<div class="user" data-id="123" data-name="john">')

// Auto wrap (default)
printer.setOption('htmlAttributeWrap', 'auto')
printer.setOption('maxLineLength', 40)
// Output:
// <div class="user"
//      data-id="123"
//      data-name="john">

// Force single line
printer.setOption('htmlAttributeWrap', 'never')
// Output: <div class="user" data-id="123" data-name="john">
```

### Indentation Styles

```javascript
// Spaces (default)
printer.setOption('indentType', 'space')
printer.setOption('indentSize', 2)

// Tabs
printer.setOption('indentType', 'tab')
printer.setOption('indentSize', 1)

// Mixed (tabs for structure, spaces for alignment)
printer.setOption('indentType', 'mixed')
```

## Integration with Tools

### Formatter Integration

```javascript
// formatter.js
import { Formatter } from '@herb-tools/formatter'
import { Printer } from '@herb-tools/printer'

class Formatter {
  constructor(options) {
    this.printer = new Printer(options.printer)
  }

  format(source) {
    // Parse source to AST
    const ast = this.parse(source)

    // Apply formatting transformations
    const formattedAST = this.transform(ast)

    // Use printer to generate formatted source
    return this.printer.print(formattedAST)
  }
}
```

### Minifier Integration

```javascript
// minifier.js
import { Minifier } from '@herb-tools/minifier'
import { Printer } from '@herb-tools/printer'

class Minifier {
  constructor() {
    this.printer = new Printer({
      indentSize: 0,
      preserveWhitespace: false,
      erbTagSpacing: 'compact',
      generateSourceMap: false
    })
  }

  minify(source) {
    const ast = this.parse(source)
    const minifiedAST = this.optimize(ast)
    return this.printer.print(minifiedAST)
  }
}
```

### Custom Code Generator

```javascript
class TemplateGenerator {
  constructor() {
    this.printer = new Printer({
      indentSize: 2,
      erbTagSpacing: 'spaced'
    })
  }

  generateTemplate(data) {
    // Build AST programmatically
    const ast = this.buildAST(data)

    // Generate source code
    return this.printer.print(ast)
  }

  buildAST(data) {
    return {
      type: 'Document',
      children: [
        {
          type: 'HTMLElement',
          tagName: 'div',
          attributes: [
            {
              type: 'HTMLAttribute',
              name: 'class',
              value: data.className
            }
          ],
          children: [
            {
              type: 'ERBContent',
              rubyCode: `@${data.variable}.${data.method}`
            }
          ]
        }
      ]
    }
  }
}
```

## Source Maps

### Generating Source Maps

```javascript
const printer = new Printer({
  generateSourceMap: true,
  sourceMapMode: 'external'
})

const result = printer.printWithSourceMap(ast)
console.log(result.code)     // Generated source code
console.log(result.map)      // Source map object

// Save source map to file
fs.writeFileSync('output.erb.map', JSON.stringify(result.map))
```

### Source Map Format

```json
{
  "version": 3,
  "sources": ["original.erb"],
  "names": [],
  "mappings": "AAAA,KAAK,CAAC,KAAK",
  "sourceRoot": "",
  "sourcesContent": ["<div><%= @user.name %></div>"]
}
```

### Using Source Maps

```javascript
// Debug formatted code
const { SourceMapConsumer } = require('source-map')

async function debugPosition(line, column) {
  const consumer = await new SourceMapConsumer(sourceMap)
  const original = consumer.originalPositionFor({ line, column })

  console.log(`Generated position ${line}:${column} maps to original ${original.line}:${original.column}`)
}
```

## API Reference

### Printer Class

```typescript
class Printer {
  constructor(options: PrinterOptions)

  // Core printing methods
  print(ast: ASTNode): string
  printWithSourceMap(ast: ASTNode): { code: string, map: SourceMap }

  // Configuration
  setOption(key: string, value: any): void
  setOptions(options: Partial<PrinterOptions>): void
  getOptions(): PrinterOptions

  // Utility methods
  static defaultOptions(): PrinterOptions
  static validateAST(ast: ASTNode): ValidationResult
}

interface PrinterOptions {
  // Indentation
  indentSize: number
  indentType: 'space' | 'tab' | 'mixed'

  // Line handling
  lineEnding: '\n' | '\r\n' | 'auto'
  maxLineLength: number
  wrapLongLines: boolean

  // ERB formatting
  erbTagSpacing: 'compact' | 'spaced' | 'preserve'
  erbOutputPadding: boolean

  // HTML formatting
  htmlAttributeWrap: 'auto' | 'force' | 'never'
  htmlSelfClosing: 'xml' | 'html' | 'preserve'

  // Comments
  preserveComments: boolean
  commentIndentation: 'align' | 'indent' | 'preserve'

  // Source maps
  generateSourceMap: boolean
  sourceMapMode: 'inline' | 'external' | 'comment'
}
```

### Node Handlers

```javascript
class Printer {
  // Override specific node handlers
  printHTMLElement(node, context) {
    // Custom HTML element printing
    return this.defaultPrintHTMLElement(node, context)
  }

  printERBContent(node, context) {
    // Custom ERB content printing
    return this.defaultPrintERBContent(node, context)
  }

  printHTMLAttribute(node, context) {
    // Custom attribute printing
    return this.defaultPrintHTMLAttribute(node, context)
  }
}
```

## Performance

### Benchmarks

| AST Size | Print Time | Memory Usage |
|----------|------------|--------------|
| Small (10 nodes) | 0.1ms | 50 KB |
| Medium (100 nodes) | 0.8ms | 200 KB |
| Large (1000 nodes) | 6ms | 1.5 MB |

### Optimization Tips

```javascript
// Reuse printer instances
const printer = new Printer(options)

// Batch processing
const results = asts.map(ast => printer.print(ast))

// Disable source maps for production
const prodPrinter = new Printer({
  ...options,
  generateSourceMap: false
})

// Stream large ASTs
const stream = printer.printStream(largeAST)
```

## Testing

### Unit Tests

```javascript
import { Printer } from '@herb-tools/printer'
import { Herb } from '@herb-tools/node'

describe('Printer', () => {
  test('round-trip preservation', () => {
    const source = '<div><%= @user.name %></div>'
    const ast = Herb.parse(source)
    const printed = new Printer().print(ast)

    expect(printed).toBe(source)
  })

  test('custom formatting', () => {
    const ast = Herb.parse('<%=@user.name%>')
    const printer = new Printer({ erbTagSpacing: 'spaced' })
    const printed = printer.print(ast)

    expect(printed).toBe('<%= @user.name %>')
  })
})
```

### Integration Tests

```javascript
test('formatter integration', () => {
  const unformatted = '<div><%=@user.name%></div>'
  const formatted = new Formatter().format(unformatted)

  expect(formatted).toBe('<div>\n  <%= @user.name %>\n</div>')
})
```

## Contributing

Areas for contribution:
- Additional formatting options
- Performance optimizations
- Source map enhancements
- Tool integrations

## Resources

- [GitHub Repository](https://github.com/marcoroth/herb/tree/main/javascript/packages/printer)
- [API Documentation](https://herb-tools.dev/printer/api)
- [Source Map Specification](https://sourcemaps.info/spec.html)
