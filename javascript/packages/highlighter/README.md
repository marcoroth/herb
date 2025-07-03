# Herb Highlighter

**Package:** [`@herb-tools/highlighter`](https://www.npmjs.com/package/@herb-tools/highlighter)

---

Syntax highlighter and diagnostic renderer for HTML+ERB templates with terminal color support.

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

<!-- ### Usage -->

<!-- TODO -->

<!-- #### Configuration Options -->

<!-- TODO -->

<!-- #### CLI Usage -->

<!-- TODO -->

## Basic Setup

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "@herb-tools/highlighter"

const theme = "default"
const highlighter = new Highlighter(theme, Herb)

await highlighter.initialize()

highlighter.highlight("filename.html.erb", "<% if true %><span>true</span><% end %>")
```
