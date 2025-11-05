# Herb Rewriter

**Package:** [`@herb-tools/rewriter`](https://www.npmjs.com/package/@herb-tools/rewriter)

---

Rewriter system for transforming HTML+ERB AST nodes and formatted strings. Provides base classes and utilities for creating custom rewriters that can modify templates.

## Overview

The rewriter package provides a plugin architecture for transforming HTML+ERB templates. Rewriters can be used to transform templates before formatting, implement linter autofixes, or perform any custom AST or string transformations.

### Rewriter Types

- **`ASTRewriter`**: Transform the parsed AST (e.g., sorting Tailwind classes, restructuring HTML)
- **`StringRewriter`**: Transform formatted strings (e.g., adding trailing newlines, normalizing whitespace)

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

## Built-in Rewriters

### Tailwind Class Sorter

Automatically sorts Tailwind CSS classes in `class` attributes according to Tailwind's recommended order.

**Usage:**
```typescript
import { TailwindClassSorterRewriter } from "@herb-tools/rewriter"

const rewriter = new TailwindClassSorterRewriter()
await rewriter.initialize({ baseDir: process.cwd() })

const result = rewriter.rewrite(parseResult, { baseDir: process.cwd() })
```

**Features:**
- Sorts classes in `class` attributes
- Auto-discovers Tailwind configuration from your project
- Supports both Tailwind v3 and v4

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

ASTRewriters receive and modify the parsed AST:

```javascript [.herb/rewriters/my-rewriter.mjs]
import { ASTRewriter, asMutable } from "@herb-tools/rewriter"

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

  // Transform the parsed AST
  rewrite(parseResult, context) {
    if (parseResult.failed) return parseResult

    // Access and modify the AST
    // parseResult.value contains the root AST node

    // To mutate readonly properties, use asMutable():
    // const node = asMutable(someNode)
    // node.content = "new value"

    return parseResult
  }
}
```

**Mutating AST Nodes:**

AST nodes have readonly properties. To modify them, use the `asMutable()` helper:

```javascript
import { asMutable } from "@herb-tools/rewriter"
import { Visitor } from "@herb-tools/core"

class MyVisitor extends Visitor {
  visitHTMLAttributeNode(node) {
    if (node.value?.children?.[0]?.type === "AST_LITERAL_NODE") {
      const literalNode = asMutable(node.value.children[0])
      literalNode.content = "modified"
    }

    super.visitHTMLAttributeNode(node)
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

By default, rewriters are auto-discovered from: `.herb/rewriters/**/*.{js,mjs,cjs}`

Which means you can just reference and configure them in `.herb.yml` using their filename.

## API Reference

### `ASTRewriter`

Base class for rewriters that transform the parsed AST:

```typescript
import { ASTRewriter } from "@herb-tools/rewriter"
import type { ParseResult, RewriteContext } from "@herb-tools/rewriter"

class MyRewriter extends ASTRewriter {
  abstract get name(): string
  abstract get description(): string

  async initialize(context: RewriteContext): Promise<void> {
    // Optional initialization
  }

  abstract rewrite(parseResult: ParseResult, context: RewriteContext): ParseResult
}
```

### `StringRewriter`

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
