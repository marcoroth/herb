# Actions <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

Actions are HTML attributes that write a [state](/language/state) when an event fires. A button that only opens a menu or counts a click needs no JavaScript of its own.

::: code-group
```erb [app/views/menus/_menu.html.erb]
<%# herb:slots client %>
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Menu</button>
<% if open %><nav>Links</nav><% end %>
```
:::

## Attributes

| Attribute             | Writes                                     | State kind      |
|-----------------------|--------------------------------------------|-----------------|
| `data-herb-set`       | `name=value`                               | any             |
| `data-herb-toggle`    | flips `true` and `false`                   | Boolean         |
| `data-herb-increment` | adds `data-herb-by`, or 1                  | Integer         |
| `data-herb-decrement` | subtracts `data-herb-by`, or 1             | Integer         |
| `data-herb-reset`     | the declared default                       | any             |
| `data-herb-action`    | runs a built-in action                     | none            |

Each takes a comma-separated list, so one click can write several states as a single update.

::: code-group
```erb [app/views/messages/_composer.html.erb]
<%# herb:slots client %>
<%# herb:state (pending: false, failed: false, attempts: 0, draft: "") %>

<button data-herb-set="pending=false,failed=true">Retry</button>
<button data-herb-increment="attempts" data-herb-by="2">More</button>
<button data-herb-decrement="attempts">Fewer</button>
<button data-herb-reset="draft">Clear</button>
<button data-herb-reset>Start over</button>
<p><%= attempts %> attempts</p>
<% if pending %><p>Sending</p><% end %>
<% if failed %><p>Failed</p><% end %>
<input value="<%= draft %>">
```
:::

`data-herb-reset` with no value resets every state in the element's scope.

## `data-herb-set`

Sets one or more states to a value.

```erb notwoslash
data-herb-set="name=value"
data-herb-set="name=value,name=value"
data-herb-set="event->name=value"
```

The value is read as the state's [kind](/language/state#kinds), so `pending=true` sets a Boolean and `draft=true` sets the String `"true"`. Quote a String value that holds a comma or a space, as in `draft='hello, world'`.

`$value` stands for the value of the element the event fired on, and it is the only interpolation. A set with no value, such as `data-herb-set="open"`, is reported by the linter and by the client in debug mode.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<%# herb:state (sort: "name") %>

<select data-herb-set="change->sort=$value">
  <option value="name">Name</option>
  <option value="date">Date</option>
</select>
<p>Sorted by <%= sort %></p>
```
:::

## `data-herb-action`

Runs a built-in action. `$refresh` asks the server to render the server-derived parts of the page again with the current states.

```erb
<button data-herb-action="$refresh">Reload</button>
```

Actions you define yourself are not available yet.

## Events

An action runs on the default event for its element unless a clause names one.

| Element                                    | Default event |
|--------------------------------------------|---------------|
| `<form>`                                   | `submit`      |
| `<input>`, `<textarea>`                    | `input`       |
| `<input>` of type `submit`, `button` or `reset` | `click` |
| `<select>`                                 | `change`      |
| `<details>`                                | `toggle`      |
| anything else                              | `click`       |

A clause is `event->operation`. Separate several clauses with a space.

```erb
<div data-herb-set="mouseenter->menu=true mouseleave->menu=false">Account</div>
<input data-herb-reset="blur->draft">
```

### Keys and modifiers

`keydown`, `keyup` and `keypress` take a key after a dot. Modifiers join the key with `+`.

```erb
<input data-herb-reset="keydown.esc->draft">
<button data-herb-set="keydown.meta+k@window->palette=true">Search</button>
```

| Key alias                     | Key            |
|-------------------------------|----------------|
| `esc`                         | Escape         |
| `return`                      | Enter          |
| `space`                       | Space          |
| `up`, `down`, `left`, `right` | the arrow keys |
| `page_up`, `page_down`        | Page Up, Page Down |

Modifiers are `meta` (or `cmd`), `ctrl`, `alt` and `shift`. A modifier may also go before any other event, as in `shift+click`. An action with a modifier prevents the browser's default for that event.

### Where the event is heard

| Suffix                  | Runs for                                   |
|-------------------------|--------------------------------------------|
| none                    | events on the element                      |
| `@window`, `@document`  | events anywhere on the page                |
| `@outside`              | events anywhere on the page except inside the element |

```erb
<div data-herb-set="click@outside->open=false keydown.esc@window->open=false">Menu</div>
```

## Timing

| Attribute             | Takes        | Does                                                         |
|-----------------------|--------------|--------------------------------------------------------------|
| `data-herb-debounce`  | milliseconds | Waits until the events stop for this long, then runs once    |
| `data-herb-throttle`  | milliseconds | Runs at most once in this long                               |

```erb
<input value="<%= query %>" data-herb-set="query=$value" data-herb-debounce="250">
```

## Scope

An action writes the nearest state with that name, looking outward from the element. Inside a keyed row that is the row's state, and outside it is the template's. A derived state cannot be written.

## What is checked where

The engine compiles any action attribute, so mistakes in one are reported by the linter and by the client in debug mode. Both flag a state name that is not declared in an enclosing scope, an operation that does not match the kind such as `data-herb-toggle` on an Integer, and a `set` value that does not parse as the kind such as `attempts=lots`. They also flag a key filter on an event that is not a key event, a target other than `@window`, `@document` and `@outside`, and any write to a derived state.

## Related rules

- [`herb-state-valid-actions`](/linter/rules/herb-state-valid-actions)
- [`herb-into-requires-collection`](/linter/rules/herb-into-requires-collection)
