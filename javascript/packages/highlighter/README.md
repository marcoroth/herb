## Herb Highlighter

##### Package: [`@herb-tools/highlighter`](https://www.npmjs.com/package/@herb-tools/highlighter)

---

Syntax highlighter and diagnostic renderer for HTML+ERB templates with
terminal color support.

## Building

Run `yarn build` to build the library.

## Running unit tests

Run `yarn test` to execute the unit tests via [Vitest](https://vitest.dev/).

## Basic Setup

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "@herb-tools/highlighter"

const theme = "default"
const highlighter = new Highlighter(theme, Herb)

await highlighter.initialize()

highlighter.highlight("filename.html.erb", "<% if true %><span>true</span><% end %>")
```
