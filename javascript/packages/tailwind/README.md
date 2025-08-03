# @herb-tools/tailwind

Tailwind CSS class sorting utilities for HTML+ERB templates using Herb's AST visitor pattern.

## Features

- 🎯 **Direct sorting**: Uses the same algorithm as `prettier-plugin-tailwindcss`
- 🚀 **Performance optimized**: No Prettier dependency, direct function calls
- 🔄 **Visitor pattern**: Integrates cleanly with Herb's AST processing
- 🎨 **ERB-aware**: Handles mixed HTML and ERB content properly
- ⚡ **Caching**: Environment setup is cached for better performance

## Installation

```bash
npm install @herb-tools/tailwind
```

## Usage

### Basic API

```typescript
import { sortTailwindClasses } from '@herb-tools/tailwind'

// Sort a class string
const sorted = await sortTailwindClasses('text-red-500 bg-blue-200 p-4 m-2')
// Result: "m-2 bg-blue-200 p-4 text-red-500"
```

### AST Integration

```typescript
import { sortTailwindClassesInAST } from '@herb-tools/tailwind'
import { Herb } from '@herb-tools/node-wasm'

// Parse and sort classes in an HTML+ERB template
await Herb.load()
const result = Herb.parse('<div class="text-red-500 bg-blue-200 p-4">content</div>')

if (!result.failed) {
  const { modified, statistics } = await sortTailwindClassesInAST(result.value, {
    enabled: true,
    verbose: true
  })
  
  console.log(`Modified: ${modified}, Stats:`, statistics)
}
```

### Visitor Pattern

```typescript
import { TailwindVisitor, TailwindRewriter } from '@herb-tools/tailwind'

// Step 1: Find class attributes
const visitor = new TailwindVisitor(true)
visitor.visit(ast)

// Step 2: Sort them
await visitor.sortAllClassAttributes()

// Step 3: Apply changes back to AST
const rewriter = new TailwindRewriter(visitor.getClassAttributes())
rewriter.visit(ast)
```

## Dependencies

- `@herb-tools/core` - Herb's core AST and visitor functionality
- `prettier-plugin-tailwindcss` (dev) - For the sorting algorithm

## License

MIT