# Herb Language Service

**Package:** [`@herb-tools/language-service`](https://www.npmjs.com/package/@herb-tools/language-service)

---

HTML+ERB language service built on the Herb parser, providing a compatible API with [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice) but with full HTML+ERB template understanding, including ActionView tag helpers.

::: tip
This package is intended for tooling developers building language servers, editor extensions, or other developer tools on top of Herb. If you're looking to use Herb in your editor, see the [Herb Language Server](/integrations/editors) instead.
:::

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/language-service
```

```shell [pnpm]
pnpm add @herb-tools/language-service
```

```shell [yarn]
yarn add @herb-tools/language-service
```

```shell [bun]
bun add @herb-tools/language-service
```
:::

## Features

- Drop-in replacement for [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice) with the same API
- Parses HTML+ERB using the Herb parser instead of a plain HTML scanner
- ActionView tag helpers like `<%= tag.div data: { controller: "scroll" } %>` are treated as `<div data-controller="scroll">` for completions and diagnostics
- Extensible via `IHTMLDataProvider` for framework-specific attributes and values
- Token list support for space-separated attributes (`class`, `data-controller`, etc.)
- Falls back to the upstream HTML parser when Herb is not available

## Migrating from `vscode-html-languageservice`

```diff
- import { getLanguageService } from "vscode-html-languageservice"
+ import { Herb } from "@herb-tools/node-wasm"
+ import { getLanguageService } from "@herb-tools/language-service"

+ await Herb.load()

  const service = getLanguageService({
+   herb: Herb,
    customDataProviders: [myDataProvider],
  })
```

All types and functions from `vscode-html-languageservice` are re-exported, so no other import changes are needed.

## Usage

Pass a Herb instance to get HTML+ERB support:

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { getLanguageService } from "@herb-tools/language-service"

await Herb.load()

const service = getLanguageService({
  herb: Herb,
  customDataProviders: [myDataProvider],
})

const document = service.parseHTMLDocument(textDocument)
const completions = service.doComplete(textDocument, position, document)
```

### Without Herb (HTML-only)

When no Herb instance is provided, the service falls back to the upstream `vscode-html-languageservice` parser:

```typescript
import { getLanguageService } from "@herb-tools/language-service"

const service = getLanguageService({
  customDataProviders: [myDataProvider],
})
```

### Custom Data Providers

Custom data providers let you add framework-specific tags, attributes, and values to the completion and hover engines. The interface is the same [`IHTMLDataProvider`](https://github.com/microsoft/vscode-html-languageservice/blob/main/src/htmlLanguageTypes.ts) from `vscode-html-languageservice`:

```typescript
import { getLanguageService, type IHTMLDataProvider } from "@herb-tools/language-service"

const stimulusProvider: IHTMLDataProvider = {
  getId: () => "stimulus",
  isApplicable: () => true,

  provideTags: () => [],

  provideAttributes: (tag) => [
    { name: "data-controller" },
    { name: "data-action" },
  ],

  provideValues: (tag, attribute) => {
    if (attribute === "data-controller") {
      return [{ name: "scroll" }, { name: "search" }]
    }

    return []
  },
}

const service = getLanguageService({
  herb: Herb,
  customDataProviders: [stimulusProvider],
  tokenListAttributes: ["data-controller", "data-action"],
})
```

Multiple providers can be composed. The language service queries all applicable providers and merges their results.

### Token List Attributes

Some attributes contain space-separated token lists (e.g., `class="foo bar"` or `data-controller="scroll search"`). Pass `tokenListAttributes` so the language service can provide per-token completions and accurate per-token diagnostic ranges:

```typescript
const service = getLanguageService({
  herb: Herb,
  tokenListAttributes: ["data-controller", "data-action"],
})
```

The defaults from `@herb-tools/core`'s `TOKEN_LIST_ATTRIBUTES` (including `class`) are always included.

## API Compatibility

This package provides the same `LanguageService` interface as [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice):

- `parseHTMLDocument(document)`
- `doComplete(document, position, htmlDocument)`
- `doHover(document, position, htmlDocument)`
- `format(document, range, options)`
- `findDocumentHighlights(document, position, htmlDocument)`
- `findDocumentLinks(document, documentContext)`
- `findDocumentSymbols(document, htmlDocument)`
- `getFoldingRanges(document, context)`
- `getSelectionRanges(document, positions)`
- `doRename(document, position, newName, htmlDocument)`
- `findMatchingTagPosition(document, position, htmlDocument)`
- `findLinkedEditingRanges(document, position, htmlDocument)`
- `createScanner(input, initialOffset)`
- `setDataProviders(useDefault, providers)`
- `setCompletionParticipants(participants)`
