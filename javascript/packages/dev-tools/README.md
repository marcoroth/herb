# Herb Dev Tools

**Package**: [`@herb-tools/dev-tools`](https://www.npmjs.com/package/@herb-tools/dev-tools)

---

Development tools for visual debugging in HTML+ERB templates. Provides a browser-based interface for inspecting ERB expressions, template boundaries, and more debugging information, together with the dev server client that applies live DOM patches.

## Installation

```bash
npm install @herb-tools/dev-tools

# or

yarn add @herb-tools/dev-tools
```

## Usage

Nothing runs on import. Call `start()` to bring up the overlay and connect to the [Herb Dev Server](/projects/dev-server).

```typescript
import { HerbDevTools } from "@herb-tools/dev-tools"

HerbDevTools.start()
```

Everything the dev tools own is page-global, so only one can run at a time. `start()` assigns the running instance to `window.HerbDevTools` and returns it. While one is running a further `start()` logs a warning and returns `null`, leaving the running instance untouched. Reach it again through `HerbDevTools.instance`.

Every part hangs off the instance, so `window.HerbDevTools.overlay` is the overlay, `window.HerbDevTools.client` is the dev server client, and `window.HerbDevTools.runtimePanel` is the runtime diagnostics panel. Each is `null` when that part is switched off.

Call `stop()` on the instance to disconnect the client, remove the overlay and every stylesheet it injected, and release the global. A later `start()` then brings up a fresh one.

```typescript
const devTools = HerbDevTools.start()

devTools?.stop()
```

### Options

- `projectPath` is the absolute path of the project, used to resolve editor links. It falls back to the `herb-project-path` meta tag.
- `overlay` can be set to `false` to connect to the dev server without drawing the overlay.
- `devServer` can be set to `false` to draw the overlay without connecting. Pass an object instead to configure the client.
- `runtimePanel` can be set to `false` to leave the runtime diagnostics panel out.

```typescript
HerbDevTools.start({
  devServer: {
    port: 8592,
    host: "localhost",
    onPatch: (message) => console.log("Patched:", message.file),
    onReload: (message) => console.log("Reloading for:", message.file),
  },
}).start()
```

## Demo

The package ships a demo page under `demo/`, a stand-in Rails posts page carrying a realistic report. A layout renders an index which renders one partial twice as a collection, and the report describes a linter error with an autofix, a linter warning, and a runtime metric against it. Every content card names the partial that rendered it, so the render stack in the panel reads against something visible on the page.

A card at the top wires up buttons for `report()`, batching, deduplication, `dismiss()`, both forms of `clear()`, `show()`, `open()`, `close()`, the expand toggle, and both [`overlay`](#overlay) modes, so every part of the API is exercisable without the console.

One of them reports entries carrying an `element`, which is the field the payload cannot express and only the JavaScript API has. Each of those cards gets a locate control that scrolls the page to its element and flashes it, and hovering the control outlines the element in place. The two point at different things on purpose, so the card labels show both shapes the panel can render: an id, as `<div#cover-three>`, and the first `data-herb-` attribute it finds, as `<article data-herb-debug-outline-type="partial">`.

`yarn dev` inside `javascript/packages/dev-tools` serves it on `http://localhost:5212` straight from `src/`, so edits hot reload with no build step.

```bash
yarn dev
```

Set `HERB_DEMO_PORT` to move it. Set `HERB_DEMO_TARGET=dist` to serve the same page against `dist/herb-dev-tools.esm.js` instead of the source, which is how to check the published artifact rather than the working tree. Run `yarn build` first in that case.

## Runtime Diagnostics

The runtime diagnostics panel docks a badge in the Herb menu and opens a list of diagnostic cards when that badge is clicked. Findings reach it two ways. A page calls the JavaScript API below, or it embeds a JSON payload that the panel reads on start and on every Turbo navigation.

**What ships today is the panel and the JavaScript API.** No producer emits the payload. There is no Ruby or Rails integration. The [payload reference](#runtime-report-payload) is specified so a future producer has something to target, and the demo page hand-writes one to exercise the reader.

The normative definition of every shape on this page is [`src/runtime/report.ts`](https://github.com/marcoroth/herb/blob/main/javascript/packages/dev-tools/src/runtime/report.ts). Where this prose and those types disagree, the types win.

### Reporting from JavaScript

`HerbDevTools.start()` assigns the running instance to `window.HerbDevTools`. Nothing in the package
runs on import, so the global does not exist before that call. A caller that also runs in production
should reach for it optionally.

```js
const handle = window.HerbDevTools?.report({
  template: "app/views/posts/_post.html.erb",
  message: "Nested `<form>` elements are not allowed.",
  code: "html-no-nested-forms",
  severity: "error",
  origin: "Herb Linter",
  location: {
    start: { line: 2, column: 3 },
    end: { line: 7, column: 10 }
  },
  suggestion: "Move the inner `<form>` out so the two submit targets are siblings.",
  docsUrl: "https://herb-tools.dev/linter/rules/html-no-nested-forms",
  source: templateSource
})
```

That call renders one card carrying the message, the suggestion, a link to the rule documentation, a
render stack, and a syntax highlighted excerpt of `templateSource` with the range marked.

`report` takes one diagnostic or an array of them. Only `template` and `message` are required, and
every other field falls back to a documented default, so a partially populated entry still renders.
The full field list is in [`diagnostics`](#diagnostics) under the payload reference.

#### `source`

`source` is the complete text of the template the entry belongs to, and it is what makes the excerpt
and the autofix diff renderable. It is a convenience of the JavaScript API. The payload carries the
same information in its top level [`sources`](#sources) map instead.

Passing `source` registers it for that template, so later calls naming the same template can leave it
out. A card whose template has no source renders its message, suggestion and render stack without an
excerpt, which is a supported state rather than a degraded one.

#### `element`

`element` points a diagnostic at the DOM node it is about. It is a live `Element`, so like
[`source`](#source) it is a convenience of the JavaScript API and has no place in the payload.

A card whose entry carries a connected element grows a locate control. Pressing it scrolls the page
to that element and flashes it, and hovering the control outlines the element where it sits.

An element that has since left the document keeps its chip and says so, reading
`<div#cover-three> no longer on the page` with the control inert. Dropping the chip instead would
leave a reader unable to tell a diagnostic about markup from one that never named any, and which of
those it is turns out to be the more useful thing to know. A Turbo navigation, a re-render, or a
removal all land here.

An element that is still on the page but has nothing rendered for it reads
`<div#cover-three> not visible (display: none)`, with the control inert for the same reason. There is
no box to scroll to and none to outline, so a live control would appear to do nothing. The chip names
the property that hides it, and its tooltip names the ancestor carrying that property when it is not
the element itself, since that ancestor is the part the card cannot show. `display: none`,
`content-visibility: hidden`, `opacity: 0` and `visibility: hidden` all land here, as does
`display: contents`, which renders its children and keeps no box of its own.

An element that is merely scrolled out of view is not this. It has a box, locating it works, and it
keeps its control.

An element the producer looked for and did not find is a different thing, and the panel cannot see
it. `document.querySelector` returns `null`, `element` arrives as `null`, and that is
indistinguishable from a diagnostic that meant to name nothing. A producer that wants to say it went
looking has to say so in its `message`.

Locating gets the panel out of its own way first. A panel filling the window collapses back to the
corner, and a dismissible overlay closes, because both of them are covering the thing you just asked
to be shown. A blocking overlay is the exception and stays exactly where it is, since nothing may
dismiss it and the page behind it did not render anyway.

#### `overlay`

By default an entry lands in the docked panel and waits to be clicked. `overlay` asks the panel to
present itself full screen instead, for a finding that the page cannot sensibly be read around.

```js
window.HerbDevTools.report({
  template: "app/views/posts/show.html.erb",
  message: "The template could not be compiled.",
  origin: "Herb Parser",
  overlay: "blocking"
})
```

It takes one of two values, and omitting it (or passing `false`) keeps the entry docked.

| Value | Presentation |
| --- | --- |
| `"blocking"` | Fills the viewport, scroll locked, with no control that closes it. |
| `"dismissible"` | The same screen inside a box over the page, closed by the × button, the backdrop, or `Escape`. |

`"blocking"` is for a page that does not exist. A template that failed to compile rendered nothing,
so there is nothing behind the overlay to go back to, and the panel therefore draws no close button,
no "Hide for this session", and no **Clear**. `Escape` does nothing. It also shows over a panel that
was hidden for the session, because a hidden panel is a preference about noise and this is not noise.

`"dismissible"` is for a page that works with something broken in it. Server-rendered markup that
failed to hydrate is the case it exists for. Closing it puts the panel back in its docked corner,
open, with the filter chip belonging to the finding that was just featured selected and that finding
scrolled into view, so what filled the screen a moment ago is the first thing you see. When the
featured findings come from more than one origin the All chip is selected instead.

Closing always lands in the same place, whether the overlay was raised over a docked panel or over an
expanded one, since **close** means leaving full screen behind and there is only one place to leave
it to. Any severity filter is released on the way out, so nothing can hide the finding you were just
looking at.

Dismissal is tracked per entry, using the same key as [deduplication](#deduplication). It survives
re-renders, which is its job, and it does not survive a new report. Calling `report()` again for a
diagnostic whose overlay was closed raises the overlay again, because a producer calling `report()`
is asking for the screen. Clearing a diagnostic forgets its dismissal along with it.

Both modes are properties of a diagnostic, not of the panel, so the overlay is up exactly as long as
something is asking for it. Removing the last entry that asked takes the overlay down.

##### The overlay shows only what asked for it

An overlay is not the panel drawn larger. It lists the entries that requested it and nothing else,
because a finding that takes the whole screen is claiming to be the thing worth reading. A page whose
template failed to compile has linter warnings and query counts still sitting in the panel, and none
of them describe a page that exists.

So the origin filters and the **Clear** control are both absent while an overlay is focused. With the
chips gone, the header is the only place left to say how much is on screen, so a focused overlay
showing more than one entry puts the count there. Everything the panel holds is still there, and
`count` still reports all of it.

A **Show other diagnostics** button in the header widens the overlay to every entry the panel holds,
with the origin filters back. It appears only when something is actually being held back. **Back to
the error** returns to the focused view, and widening the scope of a blocking overlay does not
unblock it.

The button carries no count, because none of the available counts is the right one. The badge counts
diagnostics and drops metrics, the panel's own total counts both, and neither answers "how many will
I see if I press this". Its tooltip names the exact number being held back, where there is room to be
precise about which number it is.

##### Blocking gets its own screen

A focused overlay is not styled like the panel. Its header becomes a band carrying a severity dot,
the shared `origin` of the entries as a title, and the `template:line:column` of the single entry
when there is only one. That location opens the file in the editor, the same as the paths on a card
do, and falls back to plain text when no editor handler is configured. Excerpts get more surrounding
context and a larger type size, since there is room for both.

The band is tinted by severity, never filled with it. A pale wash of the severity colour, a border of
the same hue, a severity dot, and darkened text carry the signal without a saturated block of colour
on screen, so an error reads red and a warning reads amber at the same weight. The severity comes
from the entries on show, so featuring a warning stays amber even while an unrelated error sits in
the panel behind it.

The bar's size and layout belong to the panel at full size, not to overlays, so expanding the docked
panel with its own control gets the same bar. The three full-size views (a focused overlay, a widened
one, and the expanded panel) are the same object at different scopes, and only the compact docked
panel keeps the small header.

The **colour** is narrower than that. It appears only while an overlay is focused on something, which
is the only state where one diagnostic is the subject. Widening the overlay and expanding the
panel both show the ordinary list, so both get the neutral bar. A tinted bar always means "this
entry", never "this panel".

The two modes differ in how much they take. A blocking overlay fills the viewport edge to edge with
no border, no corner radius, and nothing showing through, in the shape a framework error screen
takes. A dismissible one puts that same screen in a box over the page, with the page still visible
around it, which is the honest picture when the page underneath still works.

Widening either puts the ordinary panel title and the origin filters back, and
nothing else about the bar moves. Its layout, size, tint and controls stay where they were, so
widening does not make the page jump. How much screen the overlay takes does not change either, so a
widened blocking overlay is still edge to edge and a widened dismissible one is still a box.

#### Featuring an entry from the panel

Every card in the docked panel carries an expand control that puts that one entry on a dismissible
screen of its own, whatever it was reported with. It is a way of looking at an entry, so it does not change the
diagnostic. Closing the screen behaves exactly as closing a reported dismissible overlay does, and
the entry can be featured again afterwards.

The control is absent while a screen is already featured, and while a blocking overlay is up, since
blocking outranks it.

When entries disagree, `"blocking"` wins. A page holding one blocking finding and five dismissible
ones is blocked, and the overlay shows the blocking one alone.

##### Blocking is not uncloseable

The absent controls are the ones a **person** can reach. The reporter keeps every programmatic
route, so the producer that raised a blocking overlay can always take it down.

```js
const handle = window.HerbDevTools.report({ /* … */ overlay: "blocking" })

handle.dismiss()
```

`clear()` and `clear(origin)` do the same. This is what lets a dev server drop the overlay when the
file it complained about is saved and compiles.

#### The handle

`report` returns a handle whose `dismiss()` removes exactly what that call added.

```js
const handle = window.HerbDevTools.report([firstDiagnostic, secondDiagnostic])

handle.dismiss()
```

#### `clear(origin)`

`clear(origin)` removes every entry from one origin, which is how a source that re-runs on navigation
replaces its own findings without touching anyone else's. `clear()` with no argument removes
everything.

```js
window.HerbDevTools.clear("Herb Linter")
window.HerbDevTools.clear()
```

The argument is matched exactly against the `origin` a diagnostic carries, after the same whitespace
trim the reader applies on the way in.

The panel header carries the same operation as a control, scoped to the active origin chip. With the
All chip selected it reads **Clear all** and empties the panel. With an origin chip selected it reads
**Clear Herb Linter**, or whatever the chip says, and removes only that origin. Nothing about it is
confirmed first, because the cost of clearing is a page reload.

Clearing is not fixing and it is not hiding. It empties the panel's in-memory list and nothing else.
Diagnostics that came from the embedded payload return on the next page load, because the panel
re-reads the tag. Anything pushed through `report()` is gone until something calls `report()` again.
The stored "hidden for this session" state is untouched, so clearing and hiding stay independent.

The control closes the panel when it empties it, since an empty panel has nothing to say and the
badge has nothing to count. Clearing one origin out of several leaves the panel open on what remains.
Nothing about this touches the stored "hidden for this session" state, so the panel comes back on the
next `report()` or the next page.

`clear()` called from JavaScript leaves an emptied panel open on an empty state saying what happened,
because a panel that vanishes under a caller reads as a crash. The control can afford to close
because the person pressing it knows what they just did.

#### `show({ open })`

`show()` brings the badge back after it has been dismissed for the session. Pass `{ open: true }` to
open the panel at the same time.

```js
window.HerbDevTools.show()
window.HerbDevTools.show({ open: true })
```

#### `open({ expanded })` and `close()`

`open()` opens the runtime diagnostics panel, undismissing it first if it was hidden for the session.
Pass `{ expanded: true }` to open it filling the window, or `{ expanded: false }` to force it back
into the corner. Omitting `expanded` leaves whichever of the two the panel was last in.

```js
window.HerbDevTools.open()
window.HerbDevTools.open({ expanded: true })
window.HerbDevTools.close()
```

`close()` closes the panel and leaves the badge in place, which is what the panel's own × does.
Neither one touches the stored "hidden for this session" state, and neither can close an overlay. Use
[`overlay`](#overlay) for that.

The Herb menu carries a **Runtime Diagnostics** toggle that does the same thing without the console.
Switching it off is the panel header's "Hide for this session", and switching it back on is `show()`.
Both write the same stored state, so the two can never disagree. Neither one brings back entries that
were cleared, because those are gone rather than hidden.

#### When the panel is off

`report`, `clear`, `show`, `open` and `close` are no-ops that log nothing when the panel is switched
off with `runtimePanel: false`. Guarding the global is the only check a caller needs.

#### Deduplication

Entries are deduplicated by `template`, the `start` line of `location`, and `code`. A repeat shows a
`×n` count on the existing card instead of adding another one. When `code` is absent, `message` is
used in its place, so untyped findings and metrics on the same line stay distinct.

#### Queue cap

The panel holds at most **200** entries. Reporting past that cap drops the oldest entry rather than
growing without bound, since a report loop must not be able to exhaust the page's memory.
Deduplication happens first, so a repeated finding costs one slot no matter how often it fires.

### Filters

The panel filters on two independent axes, each a row of chips above the list. The first is
[`origin`](#origins), the second is severity.

The severity row folds the four `severity` values into three words, matching the vocabulary the badge
tooltip uses, so the panel speaks one language about severity. **Errors** and **Warnings** are what they say, **Notices**
covers `info` and `hint` together, and **Metrics** covers everything with `kind: "metric"`, which has
no severity at all. **Any severity** clears the row.

The two rows are faceted, so each one counts against the other's selection. Picking **Warnings**
leaves the origin row listing only the origins that have a warning, with counts to match, and picking
an origin does the same to the severity row. A chip is never shown leading to an empty list.

The severity row appears only when the panel holds more than one of these groups, since a row that
can only ever say "all of them" is noise. A selection that stops matching anything is released rather
than left stranded, and both selections persist for the session the same way.

### Origins

`origin` names what produced a finding. It is freeform display text. Whatever a producer writes is
what the panel shows, on the card and on the filter chip, character for character.

Herb's own producers write `Herb Parser` for parse and compile failures, `Herb Linter` for rule
violations, and `Herb Engine Runtime` for anything observed while rendering, which is where metrics
such as query counts belong. Those names are a convention documented here and nothing more. No list
of them exists in the source, and nothing checks an incoming `origin` against them.

A third-party producer picks its own stylized name, writes it into `origin`, and sees it rendered as
written.

Filtering and `clear(origin)` both match the string exactly. The `data-herb-dev-tools-origin`
attribute carries the same display string, spaces included.

#### Consistency is the producer's job

Because matching is exact, `Herb Linter` and `herb-linter` are two different origins and produce two
separate filter chips. Nothing reconciles them. A producer that emits a finding from more than one
code path has to spell the name the same way in each.

The one thing the reader does canonicalize is surrounding whitespace. `"Herb Linter "` and
`"  Herb Linter  "` are trimmed to `Herb Linter`, so a stray trailing space cannot silently split a
producer into two chips. Nothing else is touched. Case, inner spacing and punctuation are preserved.

A missing, non-string, or entirely blank `origin` becomes `unknown`.

### The panel

The badge takes its glyph and colour from the worst severity it is holding, and counts metrics separately from diagnostics, so a panel holding only metrics shows a neutral count rather than a warning over a zero.

Code excerpts and autofix diffs are rendered as ANSI by [`@herb-tools/highlighter`](/projects/highlighter) and displayed in a `<herb-ansi>` element.

The header carries no counts of its own. The filter chips directly beneath it already count every
origin and every severity, and the badge's tooltip carries the whole summary, so repeating it in the
title row only cost space the controls could use. The controls sit next to the title, and the window
controls stay at the right edge.

The header ends with a control that expands the panel to fill the window, which gives long excerpts and wide autofix diffs room to breathe. Its icon is a pair of corner brackets, pointing outwards to expand and inwards to collapse. Expanding is always user-initiated. Collapse it with the same control or by clicking the backdrop, and the panel returns to its anchored position. Both the open and the expanded state persist for the session. The host page keeps its own scrolling throughout.

`Escape` does what the close button does, so it closes the panel and leaves the badge. It does not collapse an expanded panel back into the corner, because closing is what a reader reaches for Escape to do. It is only listened for while the panel fills the window, so a docked panel never takes the key away from the page.

The panel header's "Hide for this session" and the Herb menu's **Runtime Diagnostics** toggle are the same switch. Either one hides the badge for the session, and the toggle or `show()` brings it back.

Every class and data attribute the panel owns is prefixed `herb-dev-tools-`.

## Runtime Report Payload

This section describes the JSON a producer would embed in the page. **No producer emits it today.**
A page that wants diagnostics right now should use the JavaScript API above.

### Transport

The payload is embedded in the document as a single inert JSON script tag.

```html
<script type="application/json" data-herb-diagnostics>
  { "version": 1, "renderTree": [], "diagnostics": [] }
</script>
```

Both the `type="application/json"` attribute and the `data-herb-diagnostics` attribute are
required. Only the first matching tag in the document is read. The tag may appear anywhere, though
placing it before the dev-tools bundle lets the bundle auto-initialize without waiting for
`DOMContentLoaded`.

Nothing in `@herb-tools/dev-tools` runs on import, so the tag is read when the page calls
`HerbDevTools.start()`. Placing the tag before that call lets the panel populate on its first render
instead of waiting for a refresh.

On a Turbo navigation the panel re-reads the tag. A new payload replaces everything the panel was
showing, including anything pushed through the JavaScript API, so a producer that re-renders the page
can simply emit a fresh payload.

### Example

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
      "origin": "Herb Linter",
      "location": { "start": { "line": 1, "column": 1 }, "end": { "line": 1, "column": 38 } },
      "suggestion": "Remove the inner form.",
      "docs_url": "https://herb-tools.dev/linter/rules/html-no-nested-forms",
      "fix": { "kind": "safe", "source": "<div>\n</div>\n" }
    }
  ],
  "sources": {
    "app/views/posts/_actions.html.erb": "<form action=\"/posts\">\n</form>\n"
  }
}
```

### Top level

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

The same shape the JavaScript API accepts.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `template` | yes | string | Project relative path the entry belongs to. |
| `message` | yes | string | Human readable, one sentence. |
| `node` | no | string | Id of the render tree node this entry belongs to. |
| `code` | no | string | Rule or check identifier, for example `html-no-nested-forms`. |
| `severity` | no | string | One of `error`, `warning`, `info`, `hint`. |
| `kind` | no | string | `diagnostic` or `metric`. Defaults to `diagnostic`. |
| `origin` | no | string | Freeform display text, trimmed. Defaults to `unknown`. |
| `location` | no | object | `{ start, end }`, each `{ line, column }`. |
| `suggestion` | no | string | What to do about it. |
| `docs_url` | no | string | Absolute `http` or `https` URL. Spelled `docsUrl` on the JavaScript API. |
| `value` | no | string | Badge text for a `metric`. |
| `fix` | no | object | `{ kind, source }`, the template as this one fix would rewrite it. |
| `overlay` | no | string | `blocking` or `dismissible`. Absent leaves the entry docked. |
| `source` | no | string | JavaScript API only. The payload uses top level `sources` instead. |

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

The badge takes its glyph and its colour from the worst severity currently in the panel, so an
`error` anywhere turns the badge red no matter what else is present.

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

Metrics are counted separately from diagnostics. A panel holding only metrics shows a neutral badge
carrying the metric count, never a warning glyph over a zero.

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

#### `fix`

`fix` describes what this one finding's autocorrect would do, and emitting it is entirely optional.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `source` | yes | string | The complete template source after applying this one fix. |
| `kind` | no | string | `safe` or `unsafe`. Defaults to `safe`. |

`source` is the whole file, not a patch. It carries the same meaning as the linter's `fixedContent`,
which is the template as it would read once this single correction has been applied and nothing else.
The panel computes the diff itself, so a producer never has to think about hunks or line offsets.

`kind` is used only for labelling. A `safe` fix is one the linter would apply under `--fix`, an
`unsafe` fix is one it would apply only under `--fix-unsafely`. An unrecognized `kind` falls back to
`safe`.

Nothing about `fix` is ever applied to the page or to the file on disk. The panel renders it as a
collapsed diff whose summary says so.

The whole `fix` is dropped when `source` is missing or is not a string, and when `source` is byte for
byte identical to the known source for the same template, since a fix that changes nothing has
nothing to show. A `fix` on a template whose source is unknown is kept but cannot be rendered,
because the panel has no original to diff against. That card renders everything else as usual.

#### `docs_url`

The payload spells this key `docs_url`, matching the snake_case the engine writes the rest of a
diagnostic in. The JavaScript API spells the same field `docsUrl`, matching the camelCase the rest of
that API uses. The reader accepts either, so a producer can use whichever spelling belongs to the
side it is writing from.

Only absolute `http`, `https` and `file` URLs are linked, and the scheme is matched
case-insensitively. Anything else, including `javascript:` and protocol relative URLs, renders the
`code` as plain text with no link beside it. The payload is untrusted application data and is treated
as such throughout.

### `sources`

An optional map from template path to the complete source of that template. Keys must match the
`template` values used in `renderTree` and `diagnostics` exactly. This is the payload's equivalent of
the JavaScript API's per-call `source` field.

When a template's source is present, its cards render a syntax highlighted excerpt with the
diagnostic range marked and two lines of context on either side. When it is absent, cards render
without an excerpt. Omitting `sources` is a legitimate way to keep the payload small on a page with
many templates.

Excerpts and diffs are rendered as ANSI by `@herb-tools/highlighter` and displayed in a `<herb-ansi>`
element. Highlighting arrives asynchronously, because the renderer loads a WebAssembly parser on
first use. A card renders its message, suggestion and render stack immediately and fills the excerpt
in once that resolves.

A long excerpt is easier to read once the panel is expanded to fill the window, which the control in
the panel header does.

`sources` is also the original half of every diff, so a `fix` on a template that is not in `sources`
renders no diff. A producer that emits fixes should emit the matching source.

### Degradation rules

Every part of the payload is optional-tolerant. A malformed or partial payload shows what it can and
never throws. Concretely:

- Invalid JSON is ignored with one warning.
- An unknown or missing `version` is ignored with one warning.
- A payload that is not a JSON object is ignored with one warning.
- Unparseable entries inside `renderTree` and `diagnostics` are skipped individually. One bad entry
  does not discard its neighbours.
- A payload with an empty `diagnostics` array is valid and renders an empty state. This is a useful
  signal, since it distinguishes "checked and clean" from "not checked".
- A `fix` that is unusable is dropped on its own. The card keeps its message, excerpt, and render
  stack.
- An `overlay` value the reader does not know becomes no overlay, so a payload from a newer producer
  degrades to a docked entry instead of a screen nothing can dismiss.

### Not built

A server-side producer, an asset pipeline integration, and SQL query attribution are directions this
format was shaped to allow, and none of them exist.

## Dev Server Client

> [!WARNING]
> The dev server and client are experimental and may not work correctly in all cases.

The client connects to the Herb Dev Server via WebSocket and receives messages when template files change. Depending on the type of change:

- **Text and attribute changes** are patched directly in the DOM without a page reload
- **Structural changes** (insertions, removals, ERB changes) trigger a full page reload

### Protocol

The client communicates with the Herb Dev Server using these message types:

| Message   | Direction       | Description                        |
|-----------|-----------------|------------------------------------|
| `welcome` | Server → Client | Handshake with project path        |
| `patch`   | Server → Client | Text/attribute changes to apply    |
| `reload`  | Server → Client | Structural change requiring reload |
| `error`   | Server → Client | Parse errors detected              |
| `fixed`   | Server → Client | Parse errors resolved              |
