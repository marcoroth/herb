# Herb Syntax Tree Printer

**Package:** [`@herb-tools/printer`](https://www.npmjs.com/package/@herb-tools/printer)

---

AST printer infrastructure for lossless HTML+ERB reconstruction and AST-to-source code conversion for the Herb Parser Syntax Tree.

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/printer
```

```shell [pnpm]
pnpm add @herb-tools/printer
```

```shell [yarn]
yarn add @herb-tools/printer
```

```shell [bun]
bun add @herb-tools/printer
```
:::

### Usage

#### IdentityPrinter (Provides lossless reconstruction of the original source)

For lossless reconstruction of the original source:

```javascript
import { IdentityPrinter } from '@herb-tools/printer'
import { Herb } from '@herb-tools/node-wasm'

await Herb.load()

const parseResult = Herb.parse(
  '<div class="hello" >  Hello  </div>',
  { track_whitespace: true }
)

const printer = new IdentityPrinter()
const output = printer.print(parseResult.value)

// output === '<div class="hello" >  Hello  </div>' (exact preservation)
```

#### Custom Printers

Create custom printers by extending the base `Printer` class and override specific visitors for custom behavior:

```typescript
import { Printer } from "@herb-tools/printer"
import { HTMLAttributeNode } from "@herb-tools/core"

class CustomPrinter extends Printer {
  protected write(content: string) {
    super.write(content.toUpperCase())
  }

  protected visitHTMLAttributeNode(node: HTMLAttributeNode) {
    // do nothing to strip attributes
  }
}
```

and then printing the result using `print`

```js
import { Herb } from "@herb-tools/node-wasm"

await Herb.load()

const parseResult = Herb.parse(
  '<div class="hello">  Hello  </div>',
  { track_whitespace: true }
)

const printer = new CustomPrinter()
const output = printer.print(parseResult.value)

// output === '<div >  HELLO  </div>'
```

#### Print Options

The printer supports options to control how nodes are printed:

```typescript
import { IdentityPrinter, DEFAULT_PRINT_OPTIONS } from "@herb-tools/printer"
import type { PrintOptions } from "@herb-tools/printer"

const printer = new IdentityPrinter()

// Will throw error if node has parse errors (default behavior)
const output1 = printer.print(nodeWithErrors)

// Will print the node despite parse errors
const output2 = printer.print(nodeWithErrors, { ignoreErrors: true })
```

When `ignoreErrors` is `false` (default), the printer will throw an error if you attempt to print a node that contains parse errors. Set `ignoreErrors` to `true` to print nodes with errors, which can be useful for debugging or partial AST reconstruction.

:::warning Important
The Printer expects the source to be parsed using the `track_whitespace: true` parser option for accurate source reconstruction.
:::

#### CLI Usage

```bash
# Basic round-trip printing
herb-print input.html.erb > output.html.erb

# Verify parser accuracy
herb-print input.html.erb --verify

# Show parsing statistics
herb-print input.html.erb --stats
```
