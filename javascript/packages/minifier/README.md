# Herb Minifier

**Package:** [`@herb-tools/minifier`](https://www.npmjs.com/package/@herb-tools/minifier)

---

HTML+ERB template minification. Removes non-significant whitespace while preserving whitespace in `<pre>` and `<code>` tags.

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/minifier
```

```shell [pnpm]
pnpm add @herb-tools/minifier
```

```shell [yarn]
yarn add @herb-tools/minifier
```

```shell [bun]
bun add @herb-tools/minifier
```
:::

## Usage

### Basic Usage

```typescript
import { Herb } from '@herb-tools/node-wasm'
import { Minifier } from '@herb-tools/minifier'

// Create and initialize minifier
const minifier = new Minifier(Herb)
await minifier.initialize()

const template = `
  <div class="container">
    <h1>Hello World</h1>
    <p>This is a test</p>
  </div>
`

const minified = minifier.minifyString(template)
// Result: '<div class="container"><h1>Hello World</h1><p>This is a test</p></div>'
```

### Minifying AST Nodes

You can also minify AST nodes directly:

```typescript
import { Herb } from '@herb-tools/node-wasm'
import { Minifier } from '@herb-tools/minifier'

const minifier = new Minifier(Herb)
await minifier.initialize()

const parseResult = Herb.parse(template, { track_whitespace: true })
const minifiedNode = minifier.minify(parseResult.value)
```

### Whitespace Preservation

The minifier preserves whitespace in `<pre>` and `<code>` tags:

```typescript
const template = `
  <div>
    <pre>
  Line 1
    Line 2
      Line 3
    </pre>
  </div>
`

const minified = minifier.minifyString(template)
// Result: '<div><pre>\n  Line 1\n    Line 2\n      Line 3\n    </pre></div>'
```

### ERB Support

The minifier works seamlessly with ERB templates:

```typescript
const template = `
  <div>
    <% if admin? %>
      <span>Admin</span>
    <% else %>
      <span>User</span>
    <% end %>
  </div>
`

const minified = minifier.minifyString(template)
// Result: '<div><%if admin?%><span>Admin</span><%else%><span>User</span><%end%></div>'
```

## API Reference

### `Minifier`

The main minifier class.

#### Constructor

```typescript
new Minifier(herb: HerbBackend)
```

**Parameters:**
- `herb`: The Herb backend instance

#### Methods

##### `initialize()`

```typescript
async initialize(): Promise<void>
```

Initializes the minifier by loading the Herb backend. Must be called before using minification methods.

##### `minifyString()`

```typescript
minifyString(template: string): string
```

Minifies an HTML+ERB template string.

**Parameters:**
- `template`: The template string to minify

**Returns:** The minified template string

##### `minify()`

```typescript
minify<T extends Node>(node: T): T
```

Minifies an HTML+ERB AST node.

**Parameters:**
- `node`: The AST node to minify

**Returns:** The minified AST node

## Features

- ✅ Removes non-significant whitespace
- ✅ Preserves whitespace in `<pre>` and `<code>` tags
- ✅ Supports nested preserve-whitespace tags
- ✅ Works with ERB templates
- ✅ Preserves HTML attributes
- ✅ Handles self-closing tags
- ✅ Gracefully handles parse errors (returns original template)
