# Herb Analysis

**Package:** [`@herb-tools/analysis`](https://www.npmjs.com/package/@herb-tools/analysis)

---

Project-wide analysis for HTML+ERB templates. Builds the indexes that answer questions a single template can't answer on its own, such as which partials a page renders, which pages reach a given partial, what locals a partial declares, and which nodes are affected when a piece of state changes.

## Installation

:::code-group

```shell [npm]
npm add @herb-tools/analysis
```

```shell [pnpm]
pnpm add @herb-tools/analysis
```

```shell [yarn]
yarn add @herb-tools/analysis
```

```shell [bun]
bun add @herb-tools/analysis
```

:::

## Entry Points

The package has two entry points.

`@herb-tools/analysis` holds the environment-agnostic pieces. Types, resolution helpers, and the index classes themselves. It reads nothing from disk and works in the browser.

`@herb-tools/analysis/node` holds the builders. Indexing a project walks the filesystem, so `ProjectIndex`, `buildPartialIndex`, and `buildRenderGraph` live behind this entry point.

```typescript
import { resolvePartial, affectedNodes } from "@herb-tools/analysis"
import { ProjectIndex } from "@herb-tools/analysis/node"
```

## Project Index

`ProjectIndex` is the front door. It owns the partial index and the render graph, builds them in the required order, and keeps them in step as files change.

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { ProjectIndex } from "@herb-tools/analysis/node"

await Herb.load()

const index = new ProjectIndex({ root: process.cwd(), backend: Herb })

await index.indexAll()

index.partials
index.callers
index.viewRoot
```

Call sites resolve against the partial declarations, which is why `indexAll()` indexes partials before callers. Use `indexPartials()` and `indexCallers()` directly when you need the stages apart.

## Render Graph

`RenderGraph` maps the render tree in both directions.

```typescript
const graph = index.callers

graph.callersOf("app/views/users/_card.html.erb")
graph.rootsOf("app/views/users/show.html.erb")
graph.inferSignature("app/views/users/_card.html.erb")
graph.contextOf("app/views/users/_card.html.erb")
```

`inferSignature()` derives a partial's locals from every call site that renders it, which is how a partial with no strict locals still gets a signature.

Serialize with `toJSON()` and restore with `renderGraphFrom()` to cache the graph across processes.

## Partial Index

`PartialIndex` records what each partial declares, including strict locals.

```typescript
import { declarationFromSource } from "@herb-tools/analysis/node"

const declaration = declarationFromSource(Herb, file, source)

declaration.hasDeclaration
declaration.locals
```

Each entry in `locals` is a `StrictLocal` with a `name`, a `required` flag, and the source of its default when it has one.

Serialize and restore with `partialIndexFrom()`. After an autofix rewrites a file, `refreshPartialAfterFix()` updates the entry in place and reports whether the declaration actually changed.

## Path Resolution

Helpers for mapping between files and Action View names, with no index required.

```typescript
import {
  isTemplatePath,
  isPartialPath,
  partialNameForFile,
  templateNameForFile,
  layoutCandidatesFor,
  resolvePartial,
  projectRelativePath
} from "@herb-tools/analysis"
```

## State Dependencies

`affectedNodes()` finds the nodes in a template that depend on a given piece of state. `dependencyIndex()` groups them by state name, and `affectedTemplates()` walks a graph to find every template reachable from an entry point that depends on it.

```typescript
import { affectedNodes, dependencyIndex } from "@herb-tools/analysis"

affectedNodes(Herb, source, "@post")
dependencyIndex(Herb, file, source)
```

Each result carries an `AffectedNodeKind` of `text_content`, `conditional`, `render`, `attribute_value`, `expression`, or `iteration`.

## See Also

- [Core Documentation](/projects/core) - AST node types and the visitor pattern
- [Dev Server Documentation](/projects/dev-server) - Live DOM patching built on this analysis
- [Language Server Documentation](/projects/language-server) - Editor features backed by the project index
