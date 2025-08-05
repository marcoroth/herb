# @herb-tools/rewriter

A flexible architecture for rewriting HTML+ERB AST nodes, providing both built-in rewriters and a base class for creating custom transformations.

## Features

- 🏗️ **Extensible Architecture**: Base `Rewriter` class that extends Herb's `Visitor`
- 🎨 **Built-in Rewriters**: Pre-configured rewriters for common transformations
- 🔧 **Auto-fix Support**: Perfect for linter rules that need to automatically fix violations
- 📊 **Statistics Tracking**: Built-in tracking of modifications and performance metrics
- 🚀 **High Performance**: Efficient AST traversal and modification

## Installation

```bash
npm install @herb-tools/rewriter
```

## Usage

### Using Built-in Rewriters

#### Tailwind CSS Class Sorting

```typescript
import { TailwindClassSorter } from '@herb-tools/rewriter'
import { Herb } from '@herb-tools/node-wasm'

// Parse your HTML+ERB template
await Herb.load()
const result = Herb.parse('<div class="text-red-500 bg-blue-200 p-4">content</div>')

if (!result.failed) {
  // Create and use the Tailwind class sorter
  const sorter = new TailwindClassSorter({ 
    enabled: true, 
    verbose: true 
  })
  
  const rewriteResult = sorter.process(result.value)
  
  console.log(`Modified: ${rewriteResult.modified}`)
  console.log(`Statistics:`, rewriteResult.statistics)
}
```

### Creating Custom Rewriters

#### Example: Linter Auto-fix Rewriter

```typescript
import { Rewriter } from '@herb-tools/rewriter'
import { HTMLAttributeNode, HTMLOpenTagNode } from '@herb-tools/core'

class DuplicateAttributeFixer extends Rewriter {
  protected processNode(node: Node | Token): boolean {
    if (!(node instanceof Node)) return false

    this.visit(node)
    return this.statistics.modified > 0
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const seenAttributes = new Set<string>()
    const attributesToRemove: number[] = []

    // Find duplicate attributes
    node.children.forEach((child, index) => {
      if (child instanceof HTMLAttributeNode) {
        const attrName = child.name?.name?.value
        if (attrName) {
          if (seenAttributes.has(attrName)) {
            attributesToRemove.push(index)
          } else {
            seenAttributes.add(attrName)
          }
        }
      }
    })

    // Remove duplicates (in reverse order to maintain indices)
    attributesToRemove.reverse().forEach(index => {
      node.children.splice(index, 1)
      this.trackModified()
    })

    this.trackProcessed()
    super.visitHTMLOpenTagNode(node)
  }
}
```

### Integration with Formatter

You can use rewriters before or after formatting:

```typescript
import { Formatter } from '@herb-tools/formatter'
import { TailwindClassSorter } from '@herb-tools/rewriter'
import { Herb } from '@herb-tools/node-wasm'

const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

// Parse the source
await Herb.load()
const herbBackend = new Herb()
const parseResult = herbBackend.parse(source)

if (!parseResult.failed) {
  // Apply rewriter before formatting
  const sorter = new TailwindClassSorter({ enabled: true })
  sorter.process(parseResult.value)
  
  // Then format
  const formatter = new Formatter(herbBackend)
  const formatted = formatter.format(source)
}
```

## Architecture

This architecture is designed to be extended for:

- **Linter Auto-fixes**: Rules can provide rewriters to automatically fix violations
- **Code Refactoring**: Tools for automated code transformations
- **Custom Formatting**: Domain-specific formatting rules
- **Template Optimization**: Performance optimizations for templates

### Built-in Rewriters

- **`TailwindClassSorter`**: Sorts Tailwind CSS classes in HTML class attributes

## API Reference

### `Rewriter`

Abstract base class for all rewriters.

#### Methods

- `process(ast: Node | Token): RewriterResult` - Process an AST and apply transformations
- `isEnabled(): boolean` - Check if the rewriter is enabled
- `getOptions(): Required<RewriterOptions>` - Get current options

#### Protected Methods

- `processNode(node: Node | Token): boolean` - Abstract method to implement transformation logic
- `log(message: string): void` - Log information if verbose mode is enabled
- `trackProcessed(): void` - Track that a node was processed
- `trackModified(): void` - Track that a node was modified
- `trackSkipped(): void` - Track that a node was skipped

## License

MIT