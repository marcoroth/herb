# Herb Rewriter

**Package:** [`@herb-tools/rewriter`](https://www.npmjs.com/package/@herb-tools/rewriter)

---

Rewriter system for transforming HTML+ERB AST nodes and formatted strings. Provides base classes and utilities for creating custom rewriters that can modify templates.

## Installation

:::code-group

```shell [npm]
npm add @herb-tools/rewriter
```

```shell [pnpm]
pnpm add @herb-tools/rewriter
```

```shell [yarn]
yarn add @herb-tools/rewriter
```

```shell [bun]
bun add @herb-tools/rewriter
```

:::


## Overview

The rewriter package provides a plugin architecture for transforming HTML+ERB templates. Rewriters can be used to transform templates before formatting, implement linter autofixes, or perform any custom AST or string transformations.


### Rewriter Types

- **`ASTRewriter`**: Transform the parsed AST (e.g., sorting Tailwind classes, restructuring HTML)
- **`StringRewriter`**: Transform formatted strings (e.g., adding trailing newlines, normalizing whitespace)

## Usage

### Quick Start

The rewriter package exposes two main functions for applying rewriters to templates:

#### `rewrite()` - Transform AST Nodes

Use `rewrite()` when you already have a parsed AST node:

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { rewrite } from "@herb-tools/rewriter"
import { tailwindClassSorter } from "@herb-tools/rewriter/loader"

await Herb.load()

const template = `<div class="text-red-500 p-4 mt-2"></div>`
const parseResult = Herb.parse(template, { track_whitespace: true })

const sorter = await tailwindClassSorter()
const { output, node } = rewrite(parseResult.value, [sorter])
// output: "<div class="mt-2 p-4 text-red-500"></div>"
// node: The rewritten AST node
```

#### `rewriteString()` - Transform Template Strings

Use `rewriteString()` as a convenience wrapper when working with template strings:

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { rewriteString } from "@herb-tools/rewriter"
import { tailwindClassSorter } from "@herb-tools/rewriter/loader"

await Herb.load()

const template = `<div class="text-red-500 p-4 mt-2"></div>`

const sorter = await tailwindClassSorter()
const output = rewriteString(Herb, template, [sorter])
// output: "<div class="mt-2 p-4 text-red-500"></div>"
```

**Note:** `rewrite()` returns both the rewritten string (`output`) and the transformed AST (`node`), which allows for partial rewrites and further processing. `rewriteString()` is a convenience wrapper that returns just the string.

## Built-in Rewriters

### Tailwind Class Sorter

Automatically sorts Tailwind CSS classes in `class` attributes according to Tailwind's recommended order.

**Usage:**
```typescript
import { Herb } from "@herb-tools/node-wasm"
import { rewriteString } from "@herb-tools/rewriter"
import { tailwindClassSorter } from "@herb-tools/rewriter/loader"

await Herb.load()

const template = `<div class="px-4 bg-blue-500 text-white rounded py-2"></div>`
const sorter = await tailwindClassSorter()
const output = rewriteString(Herb, template, [sorter])
// output: "<div class="rounded bg-blue-500 px-4 py-2 text-white"></div>"
```

**Features:**
- Sorts classes in `class` attributes
- Auto-discovers Tailwind configuration from your project
- Supports both Tailwind v3 and v4
- Works with ERB expressions inside class attributes

**Example transformation:**

```erb
<!-- Before -->
<div class="px-4 bg-blue-500 text-white rounded py-2">
  <span class="font-bold text-lg">Hello</span>
</div>

<!-- After -->
<div class="rounded bg-blue-500 px-4 py-2 text-white">
  <span class="text-lg font-bold">Hello</span>
</div>
```

## Custom Rewriters

You can create custom rewriters to transform templates in any way you need.

### Creating an ASTRewriter

ASTRewriters receive and modify AST nodes:

```javascript [.herb/rewriters/my-rewriter.mjs]
import { ASTRewriter } from "@herb-tools/rewriter"
import { Visitor } from "@herb-tools/core"

export default class MyASTRewriter extends ASTRewriter {
  get name() {
    return "my-ast-rewriter"
  }

  get description() {
    return "Transforms the AST"
  }

  // Optional: Load configuration or setup
  async initialize(context) {
    // context.baseDir - project root directory
    // context.filePath - current file being processed (optional)
  }

  // Transform the AST node
  rewrite(node, context) {
    // Use the Visitor pattern to traverse and modify the AST
    const visitor = new MyVisitor()
    visitor.visit(node)

    // Return the modified node
    return node
  }
}

class MyVisitor extends Visitor {
  visitHTMLElementNode(node) {
    // Modify nodes as needed
    // node.someProperty = "new value"

    this.visitChildNodes(node)
  }
}
```

### Creating a StringRewriter

StringRewriters receive and modify strings:

```javascript [.herb/rewriters/add-newline.mjs]
import { StringRewriter } from "@herb-tools/rewriter"

export default class AddTrailingNewline extends StringRewriter {
  get name() {
    return "add-trailing-newline"
  }

  get description() {
    return "Ensures file ends with a newline"
  }

  async initialize(context) {
    // Optional setup
  }

  rewrite(content, context) {
    return content.endsWith("\n") ? content : content + "\n"
  }
}
```

### Using Custom Rewriters

By default, rewriters are auto-discovered from: `.herb/rewriters/**/*.mjs`

::: info File Extension
Custom rewriters must use the `.mjs` extension to avoid Node.js module type warnings. The `.mjs` extension explicitly marks files as ES modules.
:::

#### Configuring in `.herb.yml`

Reference custom rewriters by their name in your configuration:

```yaml [.herb.yml]
formatter:
  enabled: true
  rewriter:
    pre:
      - tailwind-class-sorter  # Built-in rewriter
      - my-ast-rewriter        # Custom rewriter
    post:
      - add-trailing-newline   # Custom rewriter
```

When custom rewriters are loaded, the formatter will display them:

```
Loaded 2 custom rewriters:
  • my-ast-rewriter (.herb/rewriters/my-ast-rewriter.mjs)
  • add-trailing-newline (.herb/rewriters/add-newline.mjs)

Using 2 pre-format rewriters:
  • tailwind-class-sorter (built-in)
  • my-ast-rewriter (.herb/rewriters/my-ast-rewriter.mjs)

Using 1 post-format rewriter:
  • add-trailing-newline (.herb/rewriters/add-newline.mjs)
```

::: warning Rewriter Name Clashes
If a custom rewriter has the same name as a built-in rewriter or another custom rewriter, you'll see a warning. The custom rewriter will override the built-in one.
:::

::: tip Hot Reload
Custom rewriters are automatically reloaded when changed in editors with the Herb Language Server. No need to restart your editor!
:::

## API Reference

### Functions

#### `rewrite()`

Transform an AST node using the provided rewriters.

```typescript
function rewrite<T extends Node>(
  node: T,
  rewriters: Rewriter[],
  options?: RewriteOptions
): RewriteResult
```

**Parameters:**
- `node`: The AST node to transform
- `rewriters`: Array of rewriter instances to apply (must be already initialized)
- `options`: Optional configuration
  - `baseDir`: Base directory for resolving config files (defaults to `process.cwd()`)
  - `filePath`: Optional file path for context

**Returns:** Object with:
- `output`: The rewritten template string
- `node`: The transformed AST node (preserves input type)

#### `rewriteString()`

Convenience wrapper around `rewrite()` that parses the template string first and returns just the output string.

```typescript
function rewriteString(
  herb: HerbBackend,
  template: string,
  rewriters: Rewriter[],
  options?: RewriteOptions
): string
```

**Parameters:**
- `herb`: The Herb backend instance for parsing
- `template`: The HTML+ERB template string to rewrite
- `rewriters`: Array of rewriter instances to apply (must be already initialized)
- `options`: Optional configuration (same as `rewrite()`)

**Returns:** The rewritten template string

### Base Classes

#### `ASTRewriter`

Base class for rewriters that transform AST nodes:

```typescript
import { ASTRewriter } from "@herb-tools/rewriter"
import type { Node, RewriteContext } from "@herb-tools/rewriter"

class MyRewriter extends ASTRewriter {
  abstract get name(): string
  abstract get description(): string

  async initialize(context: RewriteContext): Promise<void> {
    // Optional initialization
  }

  abstract rewrite<T extends Node>(node: T, context: RewriteContext): T
}
```

#### `StringRewriter`

Base class for rewriters that transform strings:

```typescript
import { StringRewriter } from "@herb-tools/rewriter"
import type { RewriteContext } from "@herb-tools/rewriter"

class MyRewriter extends StringRewriter {
  abstract get name(): string
  abstract get description(): string

  async initialize(context: RewriteContext): Promise<void> {
    // Optional initialization
  }

  abstract rewrite(content: string, context: RewriteContext): string
}
```

## See Also

- [Formatter Documentation](/projects/formatter) - Using rewriters with the formatter
- [Core Documentation](/projects/core) - AST node types and visitor pattern
- [Config Documentation](/projects/config) - Configuring rewriters in `.herb.yml`
