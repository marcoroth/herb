# Herb runtime report payload

A page rendered in development can ship a JSON description of what it rendered and what is wrong
with those templates. `@herb-tools/dev-tools` reads that description, docks a small badge in the
corner of the page, and opens a panel of diagnostic cards when the badge is clicked.

This document specifies the payload for implementers on the producing side, which today means Ruby
calling into the Rust linter. The normative definition is
[`src/runtime-report.ts`](./src/runtime-report.ts). Where this prose and those types disagree, the
types win.

## Transport

The payload is embedded in the document as a single inert JSON script tag.

```html
<script type="application/json" data-herb-runtime-report>
  { "version": 1, "renderTree": [], "diagnostics": [] }
</script>
```

Both the `type="application/json"` attribute and the `data-herb-runtime-report` attribute are
required. Only the first matching tag in the document is read. The tag may appear anywhere, though
placing it before the dev-tools bundle lets the bundle auto-initialize without waiting for
`DOMContentLoaded`.

The presence of this tag is itself an auto-init trigger. A page that ships a payload does not also
need `<meta name="herb-debug-mode" content="true">`.

On a Turbo navigation the panel re-reads the tag. A new payload replaces everything the panel was
showing, including anything pushed through the client-side hook, so a producer that re-renders the
page can simply emit a fresh payload.

## Example

```json
{
  "version": 1,
  "renderTree": [
    { "id": "0", "template": "app/views/layouts/application.html.erb", "parent": null, "via": "layout" },
    { "id": "1", "template": "app/views/posts/index.html.erb", "parent": "0", "via": "template", "location": { "line": 7, "column": 10 } },
    { "id": "2", "template": "app/views/posts/_actions.html.erb", "parent": "1", "via": "partial", "location": { "line": 6, "column": 10 } }
  ],
  "diagnostics": [
    {
      "template": "app/views/posts/_actions.html.erb",
      "node": "2",
      "message": "Nested `<form>` elements are not allowed.",
      "code": "html-no-nested-forms",
      "severity": "error",
      "kind": "diagnostic",
      "origin": "herb-linter",
      "location": { "start": { "line": 1, "column": 1 }, "end": { "line": 1, "column": 38 } },
      "suggestion": "Remove the inner form.",
      "docsUrl": "https://herb-tools.dev/linter/rules/html-no-nested-forms"
    }
  ],
  "sources": {
    "app/views/posts/_actions.html.erb": "<form action=\"/posts\">\n</form>\n"
  }
}
```

## Top level

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `version` | yes | integer | Currently `1`. |
| `renderTree` | no | array | Defaults to an empty tree. |
| `diagnostics` | no | array | Defaults to no diagnostics. |
| `sources` | no | object | Template path to full template source. |

### `version`

`version` is required and is currently `1`. A payload whose version this build does not understand
is ignored entirely. The panel emits one `console.warn` per distinct unrecognized version and then
carries on. It never throws, because a diagnostics surface that can break the host page is worse
than no diagnostics surface at all. A payload with a missing or non-numeric `version` is treated the
same way as an unknown version.

Bump `version` only for a change that an older reader cannot survive. Adding a new optional field,
a new `origin`, or a new `kind` value does not require a bump, because unknown values degrade to the
documented defaults below.

### `renderTree`

An array of nodes describing what rendered what. Each node has the following fields.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | string | Unique within the payload. |
| `template` | yes | string | Project relative path. |
| `parent` | yes | string or null | `null` marks the root. |
| `via` | yes | string | One of `layout`, `template`, `partial`, `component`. |
| `location` | no | object | Where the parent rendered this node. |

`location` on a node is a `{ line, column }` pair pointing into the **parent** template, at the
`render` call that produced this node. The root has no parent and therefore no `location`.

Ids are opaque strings. They are not paths and they carry no ordering meaning. The same `template`
may appear under several ids, which is exactly what a collection render produces. Emitting one node
per occurrence is what makes it possible to attribute a diagnostic to the specific occurrence that
caused it.

Nodes with a duplicate `id`, a missing `id`, or a missing `template` are dropped. An unrecognized
`via` falls back to `template`. A `parent` that names no node in the payload terminates the walk, and
a cycle in `parent` links is broken at the first repeated node, so a malformed tree costs a truncated
render stack rather than a hung page.

### `diagnostics`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `template` | yes | string | Project relative path the entry belongs to. |
| `message` | yes | string | Human readable, one sentence. |
| `node` | no | string | Id of the render tree node this entry belongs to. |
| `code` | no | string | Rule or check identifier, for example `html-no-nested-forms`. |
| `severity` | no | string | One of `error`, `warning`, `info`, `hint`. |
| `kind` | no | string | `diagnostic` or `metric`. Defaults to `diagnostic`. |
| `origin` | no | string | Free string. Defaults to `unknown`. |
| `location` | no | object | `{ start, end }`, each `{ line, column }`. |
| `suggestion` | no | string | What to do about it. |
| `docsUrl` | no | string | Absolute `http` or `https` URL. |
| `value` | no | string | Badge text for a `metric`. |

An entry missing `template` or `message` is dropped. Everything else falls back to a default, so a
partially populated entry still renders.

#### `node`

`node` points at the render tree node the entry belongs to, which is what lets the panel show the
exact render stack for that one occurrence. When `node` is absent, or names a node that is not in
the payload, the panel falls back to the first node whose `template` matches. For a partial rendered
three times in a collection that fallback picks the first occurrence, which is usually the wrong one,
so producers that can attribute an occurrence should always emit `node`.

#### `severity`

`severity` is one of `error`, `warning`, `info`, `hint`. A missing or unrecognized `severity` on a
`diagnostic` becomes `error`, on the grounds that silently downgrading a fault is worse than
over-reporting one. Producers should always be explicit.

#### `kind` and `metric`

`kind` is `diagnostic` or `metric`, defaulting to `diagnostic`.

A `metric` carries a factual measurement rather than a fault. A partial that issued three SQL
queries is a metric. Nothing is wrong, and the number is worth surfacing next to the template that
produced it.

Because a metric is not a fault, `severity` is optional and is discarded when present. A metric
never renders a severity dot and never colors its excerpt with an error or warning marker. It
renders a neutral badge instead, whose text comes from the optional `value` field, falling back to
the word `metric`. Keep `value` short, since it sits in a pill next to the message. `3 SQL queries`
is a good `value`, a sentence is not.

#### `location`

`location` is `{ start, end }` where each endpoint is `{ line, column }`. `end` is optional and
defaults to `start`.

**Lines and columns are both 1-based.** This is worth stating loudly, because Herb's own
`Position` type in `@herb-tools/core` uses 1-based lines and **0-based** columns. A producer that
forwards a core diagnostic straight into this payload must add one to both columns. The reader
clamps anything below 1 up to 1 rather than rejecting it, so an off-by-one shows up as a marker that
starts one character early and not as a missing card.

`end.column` is exclusive in the usual half-open sense once converted back to a 0-based offset. A
37 character tag starting at the beginning of a line is `{ "start": { "line": 1, "column": 1 },
"end": { "line": 1, "column": 38 } }`.

An entry with no `location` renders with no code excerpt and no line in its innermost stack frame.
That is a supported state, not a degraded one, because some findings genuinely have no single
position.

#### `docsUrl`

Only absolute `http` and `https` URLs are linked. Anything else, including `javascript:` and
protocol relative URLs, renders the `code` as plain text. The payload is untrusted application data
and is treated as such throughout.

### `sources`

An optional map from template path to the complete source of that template. Keys must match the
`template` values used in `renderTree` and `diagnostics` exactly.

When a template's source is present, its cards render a syntax highlighted excerpt with the
diagnostic range marked and two lines of context on either side. When it is absent, cards render
without an excerpt. Omitting `sources` is a legitimate way to keep the payload small on a page with
many templates.

## Degradation rules

Every part of the payload is optional-tolerant. A malformed or partial payload shows what it can and
never throws. Concretely:

- Invalid JSON is ignored with one warning.
- An unknown or missing `version` is ignored with one warning.
- A payload that is not a JSON object is ignored with one warning.
- Unparseable entries inside `renderTree` and `diagnostics` are skipped individually. One bad entry
  does not discard its neighbours.
- A payload with an empty `diagnostics` array is valid and renders an empty state. This is a useful
  signal, since it distinguishes "checked and clean" from "not checked".

## Client-side hook

`window.HerbDevTools` exposes the same shape at runtime for sources that produce findings in the
browser rather than on the server.

```js
const handle = window.HerbDevTools.report({
  template: "app/views/posts/_actions.html.erb",
  message: "Focus left the dialog while it was open.",
  origin: "herb-a11y",
  severity: "warning",
  node: "2"
})

handle.dismiss()

window.HerbDevTools.report([diagnosticA, diagnosticB])

window.HerbDevTools.clear("herb-a11y")
window.HerbDevTools.clear()
```

`report` takes one diagnostic or an array of them, using exactly the shape documented above with
`template` and `message` required. It returns a handle whose `dismiss()` removes what that call
added. `clear(origin)` removes every entry from one origin, which is how a source that re-runs on
navigation replaces its own findings without touching anyone else's. `clear()` removes everything.

Both functions are no-ops that log nothing when dev-tools has not initialized, so a caller can use
them unconditionally in code that also runs in production.

### Deduplication

Entries are deduplicated by `template`, the `start` line of `location`, and `code`. A repeat shows a
`×n` count on the existing card instead of adding another one. When `code` is absent, `message` is
used in its place, so untyped findings and metrics on the same line stay distinct.

### Queue cap

The panel holds at most **200** entries. Reporting past that cap drops the oldest entry rather than
growing without bound, since a report loop in a client-side source must not be able to exhaust the
page's memory. Deduplication happens first, so a repeated finding costs one slot no matter how often
it fires.

## Known origins

`origin` is a free string, and the panel groups and filters by whatever it finds. These are the
values Herb itself emits.

- `herb-parser` for template parse and compile failures.
- `herb-linter` for linter rule violations.
- `herb-a11y` for accessibility findings.
- `herb-runtime` for anything observed while rendering, which is where metrics such as query counts
  belong.

Third parties should pick a stable, namespaced string. It becomes a filter button label verbatim.
