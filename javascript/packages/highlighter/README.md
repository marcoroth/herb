# Herb Highlighter

**Package:** [`@herb-tools/highlighter`](https://www.npmjs.com/package/@herb-tools/highlighter)

---

Syntax highlighter, code snippet renderer, and diagnostic renderer for HTML+ERB templates with terminal color support.

## Installation

:::code-group

```shell [npm]
npm add @herb-tools/highlighter
```

```shell [pnpm]
pnpm add @herb-tools/highlighter
```

```shell [yarn]
yarn add @herb-tools/highlighter
```

```shell [bun]
bun add @herb-tools/highlighter
```

:::

#### CLI Usage

```bash
# Highlight a file
herb-highlight app/views/users/show.html.erb

# Highlight a file with a theme
herb-highlight app/views/users/show.html.erb --theme=tokyo-night

# Highlight a file with a custom theme
herb-highlight app/views/users/show.html.erb --theme=path/to/theme.json

# Focus on line 10
herb-highlight app/views/users/show.html.erb --focus=10

# Focus on line 10 and show 3 lines before/after
herb-highlight app/views/users/show.html.erb --focus=10 --context-lines=3
```

## Usage

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "@herb-tools/highlighter"

const highlighter = new Highlighter("default", Herb)

await highlighter.initialize()

highlighter.highlight(
  "filename.html.erb",
  "<% if true %><span>true</span><% end %>",
)
```

## Configuration Options

```typescript
interface HighlightOptions {
  diagnostics?: Diagnostic[]
  splitDiagnostics?: boolean
  contextLines?: number
  focusLine?: number
  showLineNumbers?: boolean
}
```
