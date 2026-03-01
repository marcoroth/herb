# Standalone Tailwind CSS Class Sorter

**Package**: [`@herb-tools/tailwind-class-sorter`](https://www.npmjs.com/package/@herb-tools/tailwind-class-sorter)

---

A standalone Tailwind CSS class sorter that automatically sorts classes based on the [recommended class order](https://tailwindcss.com/blog/automatic-class-sorting-with-prettier#how-classes-are-sorted).

## Attribution

This package is a fork of the original [`prettier-plugin-tailwindcss`](https://github.com/tailwindlabs/prettier-plugin-tailwindcss) by [Tailwind Labs](https://tailwindlabs.com), modified to provide standalone class sorting functionality for [`@herb-tools/formatter`](@herb-tools/formatter) and other use cases. The core sorting logic and algorithms are from the original Tailwind Labs implementation.

## Key Features

* **Standalone class sorting** - Use the sorting algorithm independently from Prettier
* **Compatible with `@herb-tools/formatter`** - Designed to work seamlessly with the Herb ecosystem
* **Same sorting logic** - Uses the same proven algorithm as the original Prettier plugin
* **Full Tailwind config support** - Works with custom configs, v3 JS configs, and v4 CSS stylesheets

## Installation

```sh
npm install -D @herb-tools/tailwind-class-sorter
```

## API Reference

### Main Functions

#### `sortTailwindClasses(classStr, options?)`

Sorts a string of space-separated Tailwind CSS classes.

```js
import { sortTailwindClasses } from '@herb-tools/tailwind-class-sorter'

const result = await sortTailwindClasses('px-4 bg-blue-500 text-white rounded py-2')
// Result: 'rounded bg-blue-500 px-4 py-2 text-white'
```

**Parameters:**
- `classStr` (string): Space-separated CSS classes
- `options?` (SortTailwindClassesOptions): Configuration options

**Returns:** `Promise<string>` - Sorted class string

#### `sortTailwindClassList(classList, options?)`

Sorts an array of Tailwind CSS classes.

```js
import { sortTailwindClassList } from '@herb-tools/tailwind-class-sorter'

const result = await sortTailwindClassList(['px-4', 'bg-blue-500', 'text-white'])
// Result: { classList: ['bg-blue-500', 'px-4', 'text-white'], removedIndices: Set() }
```

**Parameters:**
- `classList` (string[]): Array of CSS classes
- `options?` (SortTailwindClassesOptions): Configuration options

**Returns:** `Promise<{ classList: string[], removedIndices: Set<number> }>` - Sorted classes and removed duplicate indices

#### `TailwindClassSorter` class

A reusable class sorter that holds a context for efficient, synchronous sorting. Ideal when you need to sort classes multiple times with the same configuration.

```js
import { TailwindClassSorter } from '@herb-tools/tailwind-class-sorter'

const sorter = await TailwindClassSorter.fromConfig({
  tailwindConfig: './tailwind.config.js'
})

const result1 = sorter.sortClasses('px-4 bg-blue-500 text-white')
const result2 = sorter.sortClasses('py-2 bg-red-500 text-black')
```

**Static Methods:**
- `TailwindClassSorter.fromConfig(options?)`: Creates sorter from config file (async)

**Constructor:**
- `new TailwindClassSorter(contextContainer, options?)`: Creates sorter from pre-loaded context (sync)

**Instance Methods:**
- `sortClasses(classStr, overrideOptions?)`: Sort classes synchronously
- `sortClassList(classList, overrideOptions?)`: Sort class array synchronously
- `getContext()`: Get the underlying context container
- `getOptions()`: Get current configuration options

### Advanced Functions

#### `sortClasses(classStr, { env, ...options })`

Low-level function for sorting with a pre-configured environment.

#### `sortClassList(classList, { env, removeDuplicates })`

Low-level function for sorting class arrays with a pre-configured environment.

#### `getTailwindConfig(options)`

Loads and configures Tailwind CSS context.

### Configuration Options

The `SortTailwindClassesOptions` interface supports the following options:

```typescript
interface SortTailwindClassesOptions {
  /** Path to the Tailwind config file */
  tailwindConfig?: string

  /** Path to the CSS stylesheet used by Tailwind CSS (v4+) */
  tailwindStylesheet?: string

  /** Preserve whitespace around Tailwind classes when sorting */
  tailwindPreserveWhitespace?: boolean

  /** Preserve duplicate classes inside a class list when sorting */
  tailwindPreserveDuplicates?: boolean

  /** Base directory for resolving config files (defaults to process.cwd()) */
  baseDir?: string
}
```

## Usage Examples

### Basic Usage

```js
import { sortTailwindClasses } from '@herb-tools/tailwind-class-sorter'

const sorted = await sortTailwindClasses('px-4 bg-blue-500 text-white rounded py-2')
// Result: 'rounded bg-blue-500 px-4 py-2 text-white'
```

### With Custom Tailwind Config (v3)

```js
const sorted = await sortTailwindClasses(
  'px-4 bg-custom-primary text-white py-2',
  {
    tailwindConfig: './tailwind.config.js'
  }
)
```

### With Tailwind v4 Stylesheet

```js
const sorted = await sortTailwindClasses(
  'px-4 bg-neon-pink text-brand-primary py-2',
  {
    tailwindStylesheet: './theme.css'
  }
)
```

### Preserving Duplicates and Whitespace

```js
const sorted = await sortTailwindClasses(
  'px-4  bg-blue-500  px-4  text-white',
  {
    tailwindPreserveDuplicates: true,
    tailwindPreserveWhitespace: true
  }
)
// Result: 'px-4  bg-blue-500  px-4  text-white'
```

### Sorting Class Arrays

```js
import { sortTailwindClassList } from '@herb-tools/tailwind-class-sorter'

const { classList, removedIndices } = await sortTailwindClassList(
  ['px-4', 'bg-blue-500', 'px-4', 'text-white'],
  { tailwindConfig: './tailwind.config.js' }
)
// classList: ['bg-blue-500', 'px-4', 'text-white']
// removedIndices: Set([2]) - duplicate px-4 at index 2 was removed
```

### Efficient Repeated Sorting with TailwindClassSorter

For scenarios where you need to sort many class strings with the same configuration, use the `TailwindClassSorter` class for better performance:

```js
import { TailwindClassSorter } from '@herb-tools/tailwind-class-sorter'

const sorter = await TailwindClassSorter.fromConfig({
  tailwindConfig: './tailwind.config.js',
  tailwindPreserveDuplicates: false
})

const components = [
  'px-4 bg-blue-500 text-white py-2',
  'mx-auto flex items-center justify-center',
  'border-2 border-gray-300 rounded-lg shadow-sm'
]

const sortedComponents = components.map(classes => sorter.sortClasses(classes))
```

### Using Pre-loaded Context

You can also create a sorter from a pre-loaded context:

```js
import { TailwindClassSorter, getTailwindConfig } from '@herb-tools/tailwind-class-sorter'

const contextContainer = await getTailwindConfig({
  tailwindConfig: './tailwind.config.js'
})

const sorter = new TailwindClassSorter(contextContainer, {
  tailwindPreserveDuplicates: false
})

const result = sorter.sortClasses('px-4 px-4 bg-blue-500 text-white')
```

### Per-Sort Option Overrides

You can override options on a per-sort basis without creating new instances:

```js
const sorter = await TailwindClassSorter.fromConfig({
  tailwindPreserveDuplicates: false
})

const normal = sorter.sortClasses('px-4 px-4 bg-blue-500')

const preserved = sorter.sortClasses('px-4 px-4 bg-blue-500', {
  tailwindPreserveDuplicates: true
})
```

## About This Fork

The original `prettier-plugin-tailwindcss` is designed as a Prettier plugin. This package extracts the sorting functionality for use in other contexts like `@herb-tools/formatter`, build tools, or any JavaScript application that needs Tailwind class sorting.

For the full Prettier plugin experience, use the [original package](https://www.npmjs.com/package/prettier-plugin-tailwindcss).

## License

MIT License - see [LICENSE](./LICENSE.txt) for details.

Original work Copyright (c) Tailwind Labs Inc.
Modified work Copyright (c) Marco Roth
