## Herb AST Printer

##### Package: [`@herb-tools/printer`](https://www.npmjs.com/package/@herb-tools/printer)

---

Base AST printer infrastructure and lossless reconstruction tool for HTML+ERB templates. Provides the foundation for all printing operations and includes tools for verifying parser accuracy.

### Installation

```bash
npm install @herb-tools/printer
# or
yarn add @herb-tools/printer
```

### Usage

#### IdentityPrinter (Recommended for basic use)

For lossless reconstruction of the original source:

```javascript
import { IdentityPrinter } from '@herb-tools/printer'
import { Herb } from '@herb-tools/node-wasm'

const parseResult = Herb.parse('<div>  Hello  </div>')
const printer = new IdentityPrinter()
const output = printer.print(parseResult.value)
// output === '<div>  Hello  </div>' (exact preservation)
```

#### Custom Printers

Create custom printers by extending the base Printer class:

```javascript
import { Printer } from '@herb-tools/printer'

class CustomPrinter extends Printer {
  // Override specific node visitors for custom behavior
  protected printTextContent(content: string): void {
    this.context.write(content.toUpperCase())
  }
}
```

#### CLI Usage

```bash
# Basic round-trip printing
herb-print input.html.erb > output.html.erb

# Verify parser accuracy
herb-print input.html.erb --verify

# Show parsing statistics
herb-print input.html.erb --stats
```


### Options

All printers accept a `PrinterOptions` object:

```typescript
interface PrinterOptions {
  // Indentation
  indentSize?: number              // Default: 2
  indentChar?: ' ' | '\t'         // Default: ' '
  lineEnding?: '\n' | '\r\n'      // Default: '\n'
  maxLineLength?: number          // Default: 80

  // HTML formatting
  selfClosingTagStyle?: '/>' | '>' // Default: '/>'
  attributeQuoteStyle?: 'double' | 'single' | 'auto' // Default: 'double'

  // ERB formatting
  erbTagSpacing?: 'compact' | 'spaced' // Default: 'spaced'

  // Whitespace handling
  preserveWhitespace?: string[]    // Tags to preserve whitespace
  collapseWhitespace?: boolean     // Default: false
  trimTextNodes?: boolean          // Default: false
  collapseMultipleSpaces?: boolean // Default: false
  collapseMultipleNewlines?: boolean // Default: false
  preserveLineBreaks?: boolean     // Default: true

  // Pretty printing
  wrapAttributes?: 'auto' | 'force' | 'preserve' // Default: 'auto'
  alignAttributes?: boolean        // Default: false
  insertFinalNewline?: boolean     // Default: true
}
```

### Related Packages

- `@herb-tools/minifier` - Provides MinifyingPrinter for compact output
- `@herb-tools/formatter` - Provides PrettyPrinter for formatted output

### API Reference

#### Printer (Base Class)

- `print(node: Node): string` - Convert AST node to string
- `visitXXXNode(node: XXXNode): void` - Override for custom node handling

#### PrintContext

Manages printing state:
- `write(text: string): void` - Add text to output
- `newline(): void` - Add line break  
- `indent(): void` / `dedent(): void` - Manage indentation
- `shouldPreserveWhitespace(): boolean` - Check preservation mode

### License

MIT
