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

Highlight a file:

```bash
herb-highlight app/views/users/show.html.erb
```

Highlight a file with a theme:

```bash
herb-highlight app/views/users/show.html.erb --theme=tokyo-night
```

Highlight a file with a custom theme:

```bash
herb-highlight app/views/users/show.html.erb --theme=path/to/theme.json
```

Focus on line 10:

```bash
herb-highlight app/views/users/show.html.erb --focus=10
```

Focus on line 10 and show 3 lines before and after:

```bash
herb-highlight app/views/users/show.html.erb --focus=10 --context-lines=3
```

Diff two files:

```bash
herb-highlight diff before.html.erb after.html.erb
```

Render a `git diff`, piped in on stdin:

```bash
git diff -- app/views | herb-highlight diff
```

Render a diff, passed as a JSON string:

```bash
herb-highlight diff '{"original": "<img src=\"a.png\">", "modified": "<img src=\"a.png\" alt=\"\">"}'
```

Render a diff from a file:

```bash
herb-highlight diff fix.json
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

## Rendering a Diff

`highlightDiff` renders the change between two sources as a syntax-highlighted diff, with the characters that actually changed picked out within each line.

```typescript
highlighter.highlightDiff(
  "filename.html.erb",
  `<span class='card'>`,
  `<span class="card">`,
)
```

```
filename.html.erb

  -   1 │ <span class='card'>
  +     │ <span class="card">
```

The line number column refers to the original source throughout, so it stays monotonic even when a fix changes the line count. Added lines have no counterpart there and are left blank.

## Rendering a Diff That Came From Elsewhere

`highlightDiffHunks` renders hunks that arrived without their sources, and the CLI exposes the same thing through `herb-highlight diff`, which takes two files, a JSON string, a file path, or stdin. It accepts unified diff text as produced by `git diff`, along with `{"original": "...", "modified": "..."}` and `{"hunks": [...]}`:

```bash
git diff -- app/views | herb-highlight --diff
```

## Configuration Options

`highlight()` takes:

```typescript
interface HighlightOptions {
  diagnostics?: Diagnostic[]
  splitDiagnostics?: boolean
  contextLines?: number
  focusLine?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
}
```

`highlightDiff()` and `highlightDiffHunks()` take:

```typescript
interface DiffRenderOptions {
  contextLines?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  highlightInlineChanges?: boolean
  removedLineStyle?: "tint" | "dim" | "none"
  singleLineStyle?: "split" | "inline" | "auto"
  layout?: "unified" | "split"
  indent?: string
}
```

`removedLineStyle` controls how the removed side is set apart: `tint` washes it in the theme's
removed background, `dim` fades it the way context lines are faded, `none` leaves it to the `-`
marker alone.

`singleLineStyle` controls whether a one-for-one line replacement is stacked or collapsed onto a
single `±` line. `auto` collapses only where that reads better: a pure insertion or deletion, whose
composite is a real line from one of the two versions, and a replacement only while the change stays
short, stays a minority of the line, and still fits the width.

`layout` chooses between stacking the two sides and putting the original in a left column with the
modified in a right one. Split falls back to unified when the terminal is too narrow to give each
column readable width.

Collapsing and tinting both need color. With `NO_COLOR` set nothing collapses and nothing is tinted,
whatever `singleLineStyle` says. A collapsed replacement would read as text belonging to neither
version, and even a collapsed insertion would show the resulting line without showing which part was
added, so the stacked pair carries more.

## Themes and Diffs

Diff backgrounds come from the theme, so a light theme gets light washes:

```json
{
  "DIFF_REMOVED_LINE_BACKGROUND": "#3A2224",
  "DIFF_ADDED_LINE_BACKGROUND": "#1E3226",
  "DIFF_REMOVED_BACKGROUND": "#6B2E31",
  "DIFF_ADDED_BACKGROUND": "#2E5E3D"
}
```

These four keys are optional. A custom theme that omits them renders diffs without any background
tinting, relying on the `+`/`-` markers, which is what the bundled `simple` theme does.
