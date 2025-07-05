# Herb Syntax Tree Printer <Badge type="info" text="coming soon" />

**Package:** [`@herb-tools/printer`](https://www.npmjs.com/package/@herb-tools/printer)

---

AST-to-source code conversion for the Herb Parser Syntax Tree.

### Installation

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

For lossless reconstruction of the original source:

```javascript
import { IdentityPrinter } from '@herb-tools/printer'
import { Herb } from '@herb-tools/node-wasm'

const parseResult = Herb.parse('<div>  Hello  </div>')
const printer = new IdentityPrinter()
const output = printer.print(parseResult.value)

// output === '<div>  Hello  </div>' (exact preservation)
```


<!-- #### Configuration Options -->

<!-- TODO -->

#### CLI Usage

```bash
# Basic round-trip printing
herb-print input.html.erb > output.html.erb

# Verify parser accuracy
herb-print input.html.erb --verify

# Show parsing statistics
herb-print input.html.erb --stats
```
