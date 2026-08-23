# Herb Client Runtime

Browser runtime for HTML+ERB templates compiled with slot markers. It reads the markers the compiler emits, keeps an index of where a template's dynamic parts ended up, and updates them in place.

> [!WARNING]
> Slots and this package are experimental. The marker format is not stable yet.

## What it is for

A template compiled with `Herb::Engine::SlotVisitor` marks every expression, conditional, collection and dynamic attribute in its output. Those markers survive rendering, so the browser can still find each part afterwards and replace just that part when its data changes. Scroll position, focus, form state and playing media all survive an update that would otherwise have replaced the page.

This package is the browser half. The index at its core stays passive. It answers where a slot is and applies the markup it is given. On top of it sit a state layer, a send queue and an action layer, and those do talk to the server and do decide when to write, always through a transport you can replace.

> [!NOTE]
> This ships to production. The development tools and the dev server client are separate packages, so nothing dev-only is in this bundle.

## Usage

Nothing starts on its own. A page that has not asked for the runtime does not get an observer:

```typescript
import { HerbRuntime } from "@herb-tools/client"

const { slots, state, mutations, actions } = HerbRuntime.start()
```

`start` is idempotent and returns the same runtime every time, so anything that needs the runtime can ask for it and get the one already running:

```typescript
const runtime = HerbRuntime.get()
```

Constructing it directly throws. A second runtime would be a second index over the same document, and neither would see the other's updates. To stop watching:

```typescript
runtime.stop()
```

## Finding slots

A slot is addressed by the template it came from and its index:

```typescript
slots.slot("app/views/posts/index.html.erb", 0)
```

A template rendered more than once has one region per rendering. `occurrence` says which, and `slotsFor` gives the same slot in every one of them:

```typescript
slots.slot("app/views/posts/index.html.erb", 0, 2)
slots.slotsFor("app/views/posts/index.html.erb", 0)
slots.regionsFor("app/views/posts/index.html.erb")
```

A rendering is not always one stretch of the page. `content_for`, `provide` and `capture` run during a rendering and hand their markup to whoever wants it, which is usually somewhere else entirely, so the compiler writes the rendering's own marker around what they captured. Two markers naming the same template, version and occurrence are the same rendering, and the region holds a range for each. Nothing about addressing changes: a slot inside a `content_for` is `slots.slot(file, index)` like any other, however far from the rest of its template it ended up.

The occurrence is the server's own count, carried in the region marker. That count and the order regions sit in are usually the same and sometimes not, because `content_for` renders its content at one point in the template and writes it out at another. A payload naming the second rendering of a template means the second one the server rendered, so reading the number is right where counting regions down the page would be off by exactly the templates that moved.

Every item of a collection repeats the same slot indices, so an item's key is what says which one is meant. The items of a collection:

```typescript
slots.itemsFor(file, 0) // Map<key, Item>
```

And one slot inside one of those items:

```typescript
slots.slotInItem(file, 0, "42", 2)
```

## Updating

Replace what a slot covers:

```typescript
slots.update(slot, "<b>new</b>")
```

Replace a single item of a collection, leaving its siblings alone:

```typescript
slots.updateItem(collection, "42", html)
```

Write an attribute, for slots anchored to an element with no comments around the value. The slot knows which attribute it stands for, so saying it is only for the case where the marker did not:

```typescript
slots.setAttribute(slot, "active")
```

Markup is parsed against the range it is going into, so a replacement `<tr>` lands correctly inside a table.

`rangeFor` gives the live range a slot covers, when you would rather write the update yourself:

```typescript
slots.rangeFor(slot)
slots.rangeForItem(item)
```

## Applying a whole payload

The compiler's other half, `Herb::Engine::DynamicsCompiler`, answers what a template's slots evaluated to. Its output goes in as it comes:

```typescript
const report = slots.apply(payload)
// { applied: 7, deferred: [] }
```

`applied` counts what was written, not what arrived. A value equal to the one already there is not written, since writing it would cost a re-parse, destroy whatever the slot contained, and announce a change that did not happen, so a payload matching the page reports `{ applied: 0, deferred: [] }` and touches nothing.

A payload names the template, the version and which rendering it is, so nothing has to be said about where it goes. A partial's values arrive nested inside the slot that rendered it and are handed to that partial's own region, so one call covers a page however many templates it was built from.

Values alone cannot do everything, and the report is the difference. `applied` counts what was written and `deferred` says what was not, with enough to act on:

```typescript
// { file, occurrence, index, reason, keys? }
```

- `stale-version` and `no-region` mean nothing was applied at all. A version that does not match says the payload's indices were compiled against a different template, so the values would land in the wrong places, and there is no partial credit to take.
- `branch` means the conditional took a branch whose markup the page never had and nothing was parked for it. Ask the server for that subtree.
- `items` means the collection had no item to copy a new one from, and `keys` lists the ones it could not build. Removing and moving need no markup, and an item the page has never had is built from one it has, because every item of a collection is the same shape by construction. A collection that rendered nothing has no item to copy, which is why a template in client mode parks one for exactly that case. Emptying a collection on the page reaches the same state, so the last item out leaves its shape behind, and this is only reached when neither exists.
- `partial-attribute` means the slot is a word interpolated into an attribute, as in `class="card <%= state %>"`. A marker says which attribute a slot is and not which stretch of it, so writing the value would drop what the template wrote around it, and refusing is the only honest answer.
- `no-slot` means the payload named an index the page has no marker for, which is usually a region that was only partly scanned.

A branch the server parked is built for you, so a template in client mode toggles a conditional with no round trip. That is the same `materialize` path, taken for you.

## Setting state

`apply` answers what to do with values once you have them. `state` is how a page asks for them.

```typescript
const { state } = HerbRuntime.start()

await state.set({ query: "ruby", page: 1 })
state.set("query", "")
state.get("query")
```

By default the query string is where the state lives, so the address bar keeps matching the page and back, forward and bookmarking all keep working without the server holding a session. `set` takes a whole object because one interaction usually changes several things at once, and everything set together travels as one request.

That default fits a view's inputs, which is what a search box, a filter and a page number are. It does not fit everything. A form about to save a row is a mutation and not a view, a long value runs into what a URL can hold, and anything private has no business in a server log or a `Referer` header. Those pages keep their state in memory:

```typescript
HerbRuntime.start({ state: { persist: "none" } })
```

A page that keeps state in memory never reads the query string and never writes to it, and everything else is unchanged. It still sends the whole state, and it still writes the slots it can.

A page that has told the client which slots read which state can write some of them itself. The compiler marks each slot with where its next value comes from:

- `identity` is a slot whose expression is the state itself, as in `<%= query %>` or `value="<%= query %>"`. The client writes it by copying. A value goes in as text, so markup inside it stays text, which is what `<%= %>` would have produced.
- `structural` is a conditional or a collection, which the client builds only from markup the server parked.
- `derived` is an expression that has to be evaluated, and evaluating it means running Ruby.

So a search box updates as fast as it is typed in, while the result count it sits above waits for the answer. The reply reconciles either way, and confirming what was already written costs nothing, because a value equal to the one on the page is not written:

```typescript
const report = await state.set("query", "ruby")
// { applied, deferred, written, restored, stale, failed }
```

`written` counts the optimistic writes. `applied` counts what the reply changed on top of them, so a reply that agrees reports `0`. A request that fails puts back every value it wrote and the state it wrote them for, reporting `restored`. A reply that arrives after a newer write has already gone out is dropped and reports `stale`, since applying it would undo something newer.

The map is delivered the way parked statics are, and is taken out of the document once read:

```html
<template data-herb-dependencies>{"state":{"@query":[{"file":"app/views/posts/index.html.erb","version":"a1b2c3d4","index":0,"mode":"identity"}]},"params":{"query":"@query"}}</template>
```

A partial knows the state under whatever name its caller passed it, so the map names every slot under the name the page uses. `Herb::Engine::SlotDependencies` builds it.

A template reads `@query` and a request carries `query`, and what joins them is a line in a controller that no template sees. So the map says which request name feeds which state, and `set` takes the request name. A name the map says nothing about is tried as the state's own name, so `state.set("@query", …)` reaches it too.

Nothing about the transport is assumed. The default asks the same URL for the `slots` format, which is what `ReActionView` serves, and any other protocol is a function:

```typescript
HerbRuntime.start({
  state: {
    transport: async (request, signal) => fetch(build(request), { signal }).then((response) => response.json()),
    debounce: 150,
    persist: "none",
  },
})
```

## Declared state

Server state answers to the server. A template can also declare state the client owns outright, with the same strict-locals signature `locals:` uses, placed where it should scope. At the top of a template it is one value per rendering, inside a keyed collection body it is one value per row:

```erb
<%# herb:state (pending: false, draft: "") %>

<% if pending %>Sending…<% else %>Sent<% end %>
<input value="<%= draft %>">
```

The server renders every state as its default, and the client owns it from there. A write never reaches the transport, every slot reading the state updates in place, and a conditional flips between parked branches with no request:

```typescript
state.setState({ pending: true })
state.getState("draft")
state.toggle("pending")
state.increment("attempts")
state.reset("draft")
```

A scoped write names the row it belongs to, resolved from any element inside it:

```typescript
const scope = state.scopeFor(button, "pending")

state.setState({ pending: true }, { scope })
```

A form control whose `value`, `checked` or `selected` reads a state is bound both ways. Typing writes the state, and the fan-out writes every other read of it. A boolean state read by a boolean attribute renders as presence, so `disabled="<%= draft == "" %>"` toggles the attribute instead of writing text into it.

`stateFor(element)` returns the same API bound to whatever scope encloses the element, and the `/stimulus` entry wires a controller in one line:

```typescript
import { useState } from "@herb-tools/client/stimulus"

export default class extends Controller {
  connect() {
    useState(this)
  }

  pendingChanged(value, previous) {}
}
```

`useState` assigns `this.state`, `this.mutations` and `this.slots`, and dispatches `<name>Changed` for whichever states the controller defines a method for.

## Actions in markup

A button that only writes a state does not need a controller. Four attributes cover the typed operations, and each accepts a comma-separated list so one interaction stays one write:

```erb
<button data-herb-toggle="expanded">Details</button>
<button data-herb-set="pending=false,failed=true">Retry</button>
<button data-herb-increment="attempts" data-herb-by="2">More</button>
<button data-herb-reset="draft">Clear</button>
```

`data-herb-decrement` is the twin of increment. The event defaults to `click` and is otherwise named inline, Stimulus-style, with space-separated clauses for several events on one element:

```erb
<select data-herb-set="change->sort=$value">
<div data-herb-set="mouseenter->menu=true mouseleave->menu=false">
```

`$value` stands for the event target's value and is the only interpolation. A value is read as whatever the state was declared to hold, so `pending=true` sets a boolean where `draft=true` sets a four-letter string.

## Sending

A mutation is a send that must not lose what the user did. `mutations` keeps a FIFO queue that never cancels an earlier send, inserts an optimistic row before the request leaves, and reconciles when the server answers:

```typescript
mutations.submit({
  url: form.action,
  body: new FormData(form),
  into: { file: "app/views/chat/show.html.erb", name: "messages" },
  values: { body: input.value },
})
```

`into` names a keyed collection by the `data-herb-name` on the element around its loop. The row is built from the empty item markup the template parked, filled with the optimistic values as text, and keyed temporarily. The confirm rekeys it in place, so the node the user is looking at survives, and applies the server's values in merge mode, which never deletes the siblings the payload does not mention. A failed send flags the row instead of dropping it, and `retry` and `discard` take the row's key or any element inside it.

A form does not need any of that written out. A form carrying `data-herb-into` is intercepted at capture phase, and everything else is derived from the form itself:

```erb
<form action="/chat/messages" method="post" data-herb-into="messages">
  <input name="message[body]" value="<%= draft %>">
  <button disabled="<%= draft == "" %>">Send</button>
</form>
```

The optimistic values come from the form's fields, with Rails model names stripped to their last bracketed segment, so `message[body]` fills the item slot named `body`.

## Reporting

The runtime declines quietly in production, and every decline carries a diagnostic. With `@herb-tools/dev-tools` running, the diagnostics land in its panel. Before it starts they queue, bounded, and flush when it attaches, so opening the panel after the fact still shows what happened. Without the dev tools nothing is retained past navigation and nothing reaches the console unless the page opts into debug mode.

## Entry points

The root export is the runtime. `/stimulus` holds the controller wiring and imports nothing from Stimulus, so the root stays framework-free. `/directives` is the static grammar of the directives and action attributes, consumed by the linter and the language service, and never loaded by an application.

## Deciding what to update

A slot inside a conditional or a collection is destroyed when that conditional or collection re-renders, so the runtime tracks what contains what. Everything an update to a slot would destroy:

```typescript
slots.descendantsOf(slot)
```

And the chain out to the top of its region:

```typescript
slots.ancestorsOf(slot)
```

For collections, `reconcile` says what has to happen to the items on the page for them to match the keys the server sent. A reorder reports as moves, not rebuilds, which is the reason to key a collection at all. `apply` carries the plan out for you; this is for deciding, not doing:

```typescript
slots.reconcile(collection, ["3", "1", "2"])
// { added: [], removed: [], moved: ["3", "1"], kept: [...], unchanged: false }
```

JavaScript sorts integer-like object keys numerically, so `JSON.parse` loses the order a payload was written in for a collection keyed by id. The payload carries an explicit `order` alongside `items`, so a collection is put in the order the server rendered whatever its keys are.

## Branches that never rendered

A conditional that was false rendered nothing, so its markup was never on the page and the client has nothing to show if it turns true. A template can park what it did not render in a `<template>`, which the runtime indexes without making it addressable. A `<template>`'s content is a separate fragment, so nothing inside one is reachable by the walker or by a selector until it is moved into the document:

```html
<template data-herb-region="app/views/posts/_card.html.erb:aaaaaaaa">
  <!--herb-branch:0:1--><b>Hello <!--herb-slot:3--><!--/herb-slot:3--></b>
  <!--herb-branch:0:2--><i>Goodbye</i>
</template>
```

Naming its own region frees it from where it sits, so it can be parked once for the page, not once per rendering, and the parser moving it is of no consequence. Which branch is which comes out of the payload, because `herb-branch` is the same marker the rendered output carries. A branch runs to the next branch marker among the payload's own children, so a conditional nested inside a branch stays with the branch containing it.

The runtime takes each one out of the document once it has read it, the way a `<turbo-stream>` element removes itself after acting. A `<template>` keeps its content when it leaves the document, so nothing is lost. What is left is the rendered output and its markers, with no trace of the parked copy. This matters for one delivered inside its region, which until it is removed sits inside the range of that region and of any slot spanning it, where an update would copy it into the page or destroy it.

Building a branch then costs only its values, with no round trip for markup the page already has:

```typescript
slots.materialize(file, "0:1", { 3: "Marco" })
```

How much a template parks is the server's call. Sending everything makes a template fully client-rendered, sending nothing leaves it server-rendered, and sending statics for one conditional and not another leaves it both. Ask which before deciding whether to fetch:

```typescript
slots.renderModeFor(file) // "client" | "server"
slots.renderModeFor(file, 0)
slots.branchesFor(file, 0)
```

A template the index has not seen reports `server`, and `materialize` returns `null` for anything it has no markup for, so a caller that always asks first is correct in every format.

Nothing parks the branch that rendered, so there is nothing to build it from once it has been replaced. Take a copy of it first and there is:

```typescript
slots.capture(slot)
```

It registers exactly what a parked branch would have been, with the values emptied out of it, and defers to the server's copy where there is one. Call it before an update that replaces a branch and no branch is ever lost.

Statics are merged as they arrive, not read as one whole set, so a later rendering can park a branch an earlier one did not. A rendering of a version the index has not seen replaces what it held, because statics compiled from one version of a template say nothing about the next.

The compiler decides what to park while rendering, and a branch that rendered is on the page already, so it parks the ones that did not. A template whose every branch ran parks nothing at all. That means a slot can report `client` while one of its branches is still a question for the server, which is what `materialize` returning `null` says.

Some conditionals never reach any of this. A conditional whose branches lay out the same way is compiled to one set of slots and no conditional at all, because which branch ran changes only what those slots hold:

```erb
<% if today? %><h1><%= Date.today %></h1><% else %><h1><%= Date.tomorrow %></h1><% end %>
```

is one child slot inside an `<h1>`, whichever way the condition goes. There is no branch to rebuild and nothing to park, and the update is a value.

## Who renders a branch

A template says so itself, and saying nothing means the server:

```erb
<%# herb:slots server %>
```

The client is told where this template's dynamic parts are, and asks the server for the markup of a branch that has not rendered. Nothing about a branch the request did not take reaches the page.

```erb
<%# herb:slots client %>
```

The client is sent the branches that did not render, parked in a `<template>`, and builds them itself. Both are slot aware, and these two only say who fills a slot.

## Naming a template

Every marker names the template it came from, and by default that name is the path. That is the useful answer while developing and the wrong one to serve, because the markers go out with the page and a view tree says more about an application than its pages do. The compiler can name a template by a digest of its path instead:

```ruby
Herb::Engine::SlotVisitor.new(identifier: :digest)
```

Then the page carries `<!--herb-region:bf0ebc682928:fd3dfd36:0-->` and nothing else changes. The runtime treats the name as opaque, so `slots.slot(name, 0)` works the same either way. A callable decides for itself, and the visitor keeps the real path in `schema[:file]` for the server, which is the side that holds the mapping back.

## Keeping the index current

`start` opens a `MutationObserver` on `document.documentElement`, so markup that arrives after it is indexed as it lands and markup that leaves is dropped. Nothing has to be called on navigation.

The root is the document element, not the body, because Turbo replaces the whole body on a visit. An observer rooted at the body would be left watching a node that is no longer in the document, and the next page would never be indexed. Frames, streams and restored cache snapshots are all mutations inside the document, so they need nothing special.

To drive the index yourself instead, index what just arrived:

```typescript
const index = new SlotIndex()

index.scan(element)
```

And drop what left the document:

```typescript
index.prune()
```

`scan` takes a node or a list of nodes and only walks what it is given, so its cost tracks what changed, not the size of the page.

## How slots are marked

Most slots are a pair of comments around what they render:

```html
<p>Hi <!--herb-slot:0-->Marco<!--/herb-slot:0-->!</p>
```

A slot that is the whole content of one element is marked on the element instead, which costs no extra nodes:

```html
<td class="name" data-herb-slot="0:child">Marco</td>
```

Slots that cannot take comments at all are named on the element with their type. That covers attributes, whole-element expressions, and the content of `<title>` and `<textarea>`. One element can carry several, written as a space-separated list, so `~=` finds a slot without parsing the attribute:

```html
<li id="1" data-herb-slot="1:attribute:id 2:child">Marco</li>
```

```javascript
document.querySelectorAll('[data-herb-slot~="2:child"]')
```

Comments are kept where an element cannot carry the slot: mid-text, spanning siblings, or anywhere the slot might render nothing. An untaken conditional still leaves an empty pair, so the position stays addressable:

```html
<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
```
