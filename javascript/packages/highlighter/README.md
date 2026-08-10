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

Render a file as an HTML fragment:

```bash
herb-highlight app/views/users/show.html.erb --format html
```

Print the document IR as JSON:

```bash
herb-highlight app/views/users/show.html.erb --format json
```

Print the stylesheet the HTML output expects:

```bash
herb-highlight --emit-css onedark
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

## Output Formats

`--format` selects `ansi`, `html`, or `json` and defaults to `ansi`. All three render the same document, so the terminal view and the browser view stay in step. The `diff` subcommand takes the same flag, so a diff can be rendered as HTML with tinted rows and inline change marks, or emitted as JSON.

### HTML

`--format html` renders a self-describing fragment:

```html
<figure class="herb-highlight" data-herb-theme="onedark">
<figcaption class="herb-file-header">show.html.erb</figcaption>
<pre class="herb-code"><code><span class="herb-line" data-line="1"><span class="herb-token-html-tag-start">&lt;</span><span class="herb-tag-name">div</span><span class="herb-token-html-tag-end">&gt;</span></span>
<span class="herb-line" data-line="2"><span class="herb-token-whitespace">  </span><span class="herb-token-erb-start">&lt;%</span> <span class="herb-ruby-keyword">if</span> user <span class="herb-token-erb-end">%&gt;</span></span>
</code></pre>
</figure>
```

Each line is a `span` carrying its line number in `data-line`, and the stylesheet draws the number from that attribute with a `::before` rule. The gutter is never text content, so selecting the snippet and copying it yields the code alone.

### JSON

`--format json` prints the document IR that the ANSI and HTML renderers both consume:

```json
{
  "version": 1,
  "nodes": [
    { "type": "FileHeader", "path": "show.html.erb", "line": null, "column": null, "url": null },
    { "type": "CodeBlock", "kind": "Listing", "firstLine": 1, "runs": ["..."], "lines": ["..."] }
  ]
}
```

The document is versioned, and it carries no colors, no theme, and no assumptions about a terminal. It can be stored, shipped across a process boundary, and rendered later by a consumer that knows nothing about how it was produced.

## Stylesheets

The HTML output carries class names and CSS custom properties only, so all styling comes from a stylesheet. `--emit-css` prints the one matching a theme:

```bash
herb-highlight --emit-css onedark > herb.css
```

Every color is read through a custom property, so a page can override single tokens without regenerating any markup:

```css
.herb-highlight .herb-file-header {
  color: var(--herb-file-header, #11A8CD);
}
```

A `dark:light` pair emits a dark base, a light block behind `prefers-color-scheme: light`, and explicit `data-herb-appearance` overrides:

```bash
herb-highlight --emit-css onedark:github-light > herb.css
```

```css
/* herb-highlight theme: onedark:github-light */

.herb-highlight { --herb-ruby-keyword: #C678DD; }

@media (prefers-color-scheme: light) {
  .herb-highlight { --herb-ruby-keyword: #D73A49; }
}

.herb-highlight[data-herb-appearance="dark"] { --herb-ruby-keyword: #C678DD; }
.herb-highlight[data-herb-appearance="light"] { --herb-ruby-keyword: #D73A49; }
```

The attribute overrides come after the media query and therefore win, so a site with its own theme toggle can pin any fragment to one appearance by setting `data-herb-appearance` on it, while fragments without the attribute keep following the OS setting.

## Diagnostics in HTML

`--diagnostics` and `--split-diagnostics` work under `--format html` too, and four flags shape the markup they produce.

`--html-markers` selects the marker strategy and defaults to `spans`, which wraps each marked token in a `<mark>`:

```html
<mark class="herb-marker herb-marker-warning"><span class="herb-attr-name">src</span></mark>
```

`highlight-api` keeps the token spans pristine and stores the marked ranges on the line instead:

```html
<span class="herb-line herb-line-marked" data-line="1" data-herb-severity="warning" data-herb-markers="[[0,17,&quot;warning&quot;]]">
```

A hydration script then reads `data-herb-markers` and paints the ranges through the CSS Custom Highlight API, registering one highlight per severity with priorities so that an error outranks a warning on the same characters. `--html-chrome document` embeds that script into the page.

`--html-messages` selects how annotation messages appear and defaults to `inline`, which renders each message as a visible annotation under the marked tokens. `hover` emits the same markup with a `herb-messages-hover` class on the figure, and the stylesheet turns the messages into pure-CSS tooltips revealed while the marked line is hovered or holds focus.

`--html-chrome` selects between `fragment`, the default, and `document`, which wraps the output in a standalone HTML page with the stylesheet embedded, plus the hydration script when `--html-markers highlight-api` is active.

`--html-fragment-separator` prints a separator line between the fragments of `--split-diagnostics` output, so a consuming process can split the stream into one fragment per diagnostic:

```bash
herb-highlight show.html.erb --diagnostics diagnostics.json --split-diagnostics \
  --format html --html-fragment-separator '<!-- herb-fragment -->'
```

A separator that starts with `-` would be read as a flag, so it needs the `=` spelling, as in `--html-fragment-separator=----fragment----`.

## Library API

The CLI is a thin layer over the exported rendering pipeline, which can be driven directly.

`highlightRuns` lexes content into styled runs, the atoms every renderer consumes:

```typescript
import { SyntaxRenderer, resolveTheme } from "@herb-tools/highlighter"

const renderer = new SyntaxRenderer(resolveTheme("onedark"))
await renderer.initialize()

renderer.highlightRuns("<span>")
// [
//   { text: "<",    role: { kind: "Token", tokenType: "TOKEN_HTML_TAG_START" } },
//   { text: "span", role: { kind: "TagName" } },
//   { text: ">",    role: { kind: "Token", tokenType: "TOKEN_HTML_TAG_END" } },
// ]
```

`buildDocument` assembles the document IR that `highlight()` renders, dispatched on the same options:

```typescript
const document = highlighter.buildDocument("show.html.erb", content, { diagnostics })
```

`renderDocumentHTML` renders a document as an HTML fragment:

```typescript
import { renderDocumentHTML } from "@herb-tools/highlighter"

renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })
```

`generateStylesheet` prints the stylesheet those fragments expect, with an optional light counterpart for a `dark:light` pair:

```typescript
import { generateStylesheet, resolveTheme } from "@herb-tools/highlighter"

generateStylesheet(resolveTheme("onedark"), "onedark")

generateStylesheet(resolveTheme("onedark"), "onedark:github-light", {
  scheme: resolveTheme("github-light"),
  label: "github-light",
})
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
