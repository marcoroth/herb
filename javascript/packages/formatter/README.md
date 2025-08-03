# Herb Formatter <Badge type="warning" text="experimental preview" />

**Package:** [`@herb-tools/formatter`](https://www.npmjs.com/package/@herb-tools/formatter)

> [!WARNING] Experimental Preview
> This formatter is currently in experimental preview. While it works for many common cases, it may potentially corrupt files in edge cases. Only use on files that can be restored via git or other version control systems.

---

Auto-formatter for HTML+ERB templates with intelligent indentation, line wrapping, and ERB-aware pretty-printing.

Perfect for format-on-save in editors and formatting verification in CI/CD pipelines. Transforms templates into consistently formatted, readable code while preserving all functionality.

### Installation


:::code-group
```shell [npm]
npm add @herb-tools/formatter
```

```shell [pnpm]
pnpm add @herb-tools/formatter
```

```shell [yarn]
yarn add @herb-tools/formatter
```

```shell [bun]
bun add @herb-tools/formatter
```
:::

### Usage


#### Format a file

```bash
# relative path
herb-format templates/index.html.erb

# absolute path
herb-format /full/path/to/template.html.erb
```

#### Format from stdin

```bash
cat template.html.erb | herb-format
# or explicitly use "-" for stdin
herb-format - < template.html.erb
```

#### Programmatic Usage

```typescript
import { Formatter } from '@herb-tools/formatter'
import { Herb } from '@herb-tools/node-wasm'

await Herb.load()
const herbBackend = new Herb()

const formatter = new Formatter(herbBackend, {
  indentWidth: 2,
  maxLineLength: 80
})

const formatted = formatter.format(source)
```

#### Rewriter Integration

The formatter supports running rewriters before and after formatting, enabling powerful transformations like class sorting, auto-fixes, and more.

```typescript
import { Formatter } from '@herb-tools/formatter'
import { TailwindClassSorter } from '@herb-tools/rewriter'
import { Herb } from '@herb-tools/node-wasm'

await Herb.load()
const herbBackend = new Herb()

const formatter = new Formatter(herbBackend, {
  indentWidth: 2,
  maxLineLength: 80,
  rewriters: {
    // Run before formatting (e.g., sort classes before line wrapping)
    before: [
      new TailwindClassSorter({ enabled: true, verbose: false })
    ],
    // Run after formatting (e.g., final cleanup)
    after: [
      // Add other rewriters here
    ]
  }
})

const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'
const formatted = formatter.format(source)
// Result: classes are sorted AND properly formatted
```

##### Rewriter Pipeline

The formatter follows this pipeline:

1. **Parse** source to AST
2. **Before Rewriters** - Run on parsed AST (e.g., class sorting, attribute normalization)
3. **Format** - Apply formatting rules (indentation, line wrapping, etc.)
4. **After Rewriters** - Run on formatted output (e.g., final cleanup, optimizations)

##### Per-call Rewriter Override

You can also specify rewriters per format call:

```typescript
const formatter = new Formatter(herbBackend)

// Use rewriters for this specific format call
const formatted = formatter.format(source, {
  rewriters: {
    before: [new TailwindClassSorter({ enabled: true })]
  }
})
```

##### Creating Custom Rewriters

Rewriters extend the base `Rewriter` class from `@herb-tools/rewriter`:

```typescript
import { Rewriter } from '@herb-tools/rewriter'
import { HTMLOpenTagNode } from '@herb-tools/core'

class CustomRewriter extends Rewriter {
  protected processNode(node: Node | Token): boolean {
    // Your transformation logic here
    this.visit(node) // Traverse the AST
    return this.statistics.modified > 0
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    // Transform specific node types
    this.trackProcessed()
    if (/* some condition */) {
      // Make changes to the node
      this.trackModified()
    }
    super.visitHTMLOpenTagNode(node)
  }
}
```

<!-- #### Configuration Options -->

<!-- TODO -->

<!-- #### CLI Usage -->

<!-- TODO -->
