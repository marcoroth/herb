# State <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

State is data the browser owns. A template declares it, the server renders it with its default, and from then on the client changes it and updates every part of the page that reads it, without a request.

::: code-group
```erb [app/views/menus/_menu.html.erb]
<%# herb:slots client %>
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Menu</button>
<% if open %><nav>Links</nav><% end %>
```
:::

## `herb:state`

Declares the states a template or a collection row owns.

```erb notwoslash
<%# herb:state (name: default, name: default, ...) %>
```

The signature has the same shape as a [strict locals](/language/strict-locals) signature. Every state is a keyword with a default, and the default decides its [kind](#kinds).

**A template that declares state has to be compiled with slots.** Add a [`herb:slots`](/language/slots) directive, or turn slots on for the whole application in ReActionView.

Each scope declares all of its states in one directive, written on one line. Put one space after `<%#`, one space before the signature and one space before `%>`, and leave out trim markers. A state name is unique in its scope, and it may not also be the name of a strict local.

## Kinds

The default decides what kind of value a state holds. The client checks every write against it, so `pending=true` sets a Boolean where `draft=true` sets the four-character String `"true"`.

| Kind | Default | Example |
| --- | --- | --- |
| Boolean | `true` or `false` | `open: false` |
| Integer | a whole number | `attempts: 0` |
| String | a string literal | `sort: "name"` |
| Symbol | a symbol literal | `tab: :inbox` |
| Nil | `nil` | `selection: nil` |
| Seeded | a strict local | `open: open_initially` |

Prefer Boolean, Integer and String states. JavaScript has no symbols, so a String is the same value on the server and in the browser.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<%# herb:state (pending: false, attempts: 0, sort: "name", tab: "inbox", selection: nil) %>

<p><%= attempts %> attempts, sorted by <%= sort %></p>
<% if pending %>Sending<% end %>
<% if tab == "inbox" %>Inbox<% end %>
<% if selection.nil? %>Nothing selected<% end %>
```
:::

**Floats, Arrays and Hashes are rejected.** Ruby and JavaScript print a Float differently, so the server and the client would render different text. An Array on the page is a collection of rows, each of which can declare its own state. A Hash is a grouping, and each of its values can be a state of its own.

```
app/views/rates/show.html.erb:2:23: The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text.
```

## Seeding from a strict local

A default that is a bare identifier names a strict local. The server renders the state with whatever the caller passed, and the client owns it from there.

::: code-group
```erb [app/views/menus/_menu.html.erb]
<%# locals: (open_initially: false) %>
<%# herb:slots client %>
<%# herb:state (open: open_initially) %>

<button data-herb-toggle="open">Menu</button>
<% if open? %><nav>Menu</nav><% end %>
```
:::

A seeded state has no fixed kind at compile time, so the client takes its kind from the value the server rendered.

## Binding a partial's state

A partial declares its own states and owns them. The `state:` option on `render` lets the caller decide, per render, to bind one of them to a state of its own or to start it at another value.

```erb notwoslash
<%= render "partial", locals, state: { name: value } %>
```

::: code-group
```erb [app/views/shared/_album_card.html.erb]
<%# locals: (album:) %>
<%# herb:slots client %>
<%# herb:state (open: false) %>

<article>
  <h2><%= album.title %></h2>
  <button data-herb-toggle="open">Tracks</button>
  <% if open %><ol><li>Intro</li></ol><% end %>
</article>
```

```erb [app/views/albums/index.html.erb]
<%# herb:slots client %>
<%# herb:state (expanded: false) %>

<button data-herb-toggle="expanded">Expand all</button>
<% @albums.each do |album| %>
  <%# herb:key album.id %>
  <%= render "shared/album_card", album: album, state: { open: expanded } %>
<% end %>
```
:::

When the value is a state of the calling template, the two are one state. Toggling `open` inside any card writes `expanded`, and every card bound to it follows. When the value is a literal, such as `state: { open: true }`, it only sets where the partial's own state starts.

The same partial rendered without `state:` keeps its own `open`. The compiler opens the partial to check each binding, so the partial is named by its literal path with its directory, like `"shared/album_card"`. A name the partial does not declare, a kind that does not match, and a binding to a derived or counted state are compile errors at the render call.

```
app/views/albums/index.html.erb:7:58: `shared/album_card` declares no state `opened`, so `state:` has nothing to bind it to.
```

## Derived states

A default that reads other states declared before it in the same signature makes the state derived. The client re-evaluates it whenever one of its sources changes.

::: code-group
```erb [app/views/messages/_composer.html.erb]
<%# herb:slots client %>
<%# herb:state (pending: false, failed: false, busy: pending || failed) %>

<div><% if busy %>Working<% else %>Ready<% end %></div>
<input disabled="<%= busy %>">
```
:::

A derived default reads only states, using the same [read shapes](#reading-a-state) a condition may use. It may not read a state declared after it, or a state from an enclosing scope. Nothing can write a derived state, since its value follows from its sources.

**A derived default may not mix state reads with other Ruby.** The client has no answer for the Ruby half.

```
app/views/messages/_composer.html.erb:2:39: The state `busy` defaults to `pending || current_user.admin?`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none.
```

## Scope

A directive at the top of a template declares one value per rendering of that template. A directive inside the body of a keyed loop declares one value per row.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<ul>
  <% @messages.each do |message| %>
    <%# herb:key message.id %>
    <%# herb:state (pending: false) %>
    <li><%= message.body %> <% if pending? %>Sending<% end %></li>
  <% end %>
</ul>
```
:::

Give the row a [key](/language/keys) so the client can tell the rows apart. Without one the engine warns, and inserting or reordering a row re-renders every row after it. A name may be declared in a row or in its template, but not in both.

## Reading a state

A read the client can resolve updates in place the moment the state changes. Any other Ruby expression that reads a state still renders, but the client has to ask the server for its new value.

| Read | Example |
| --- | --- |
| Bare | `<%= attempts %>`, `<% if pending %>`, `<% unless pending %>` |
| Predicate | `pending?`, which reads the same as `pending` |
| Compared to a literal of its kind | `sort == "name"`, `sort != "date"` |
| Ordered, for an Integer | `attempts > 3`, `attempts <= 10` |
| Compared to a state of the same kind | `counter1 > counter2` |
| Switched over | `case sort` with literal `when` arms |
| Combined | `pending? \|\| failed?`, as long as every side reads a state |
| Negated | `!pending`, `!(attempts > 3)`, `not pending` |

A boolean attribute takes the same shapes, and reads as presence. `disabled="<%= draft == "" %>"` adds or removes the attribute instead of writing text into it.

### Predicates

Seven Ruby predicates read as the comparison they stand for.

| Predicate | Reads | Resolves as |
| --- | --- | --- |
| `nil?` | every state | `state == nil` |
| `positive?` | an Integer state | `state > 0` |
| `zero?` | an Integer state | `state == 0` |
| `one?` | an Integer state | `state == 1` |
| `empty?` | a String or Symbol state | `state == ""` |
| `blank?` | a Boolean, String or Nil state | Active Support blankness, whitespace included |
| `present?` | a Boolean, String or Nil state | the opposite of `blank?` |

### Transforms

`to_s` reads a state of any kind as a String, so `nil.to_s` is `""`. `length` and `size` read the character count of a String or Symbol state.

A transform may be printed on its own or compared against a literal or another state.

::: code-group
```erb [app/views/messages/_composer.html.erb]
<%# herb:slots client %>
<%# herb:state (attempts: 0, sort: "name", draft: "") %>

<% if attempts > 3 %><p>Too many</p><% end %>
<p><% if sort == "name" %>By name<% else %>By date<% end %></p>
<% if attempts.zero? %><p>First try</p><% end %>
<button disabled="<%= draft.blank? %>">Send</button>
<p><%= draft.length %> characters</p>
```
:::

`count` is not supported, because `String#count` takes a character set and has no client answer.

## Writing a state

A state changes in three ways, all on the client.

The first is an [action attribute](/language/actions) such as `data-herb-toggle`. The second is a form control bound to the state, where `value`, `checked` or `selected` reads it. The third is the [client runtime](/projects/client), from your own JavaScript.

A bound control writes the state as the user types or clicks, and every other read of the state follows. `checked` and `selected` bind a Boolean state. `value` and the content of a `<textarea>` bind a String state, or an Integer for numeric inputs.

A `<select>` is the exception. HTML has no `value` attribute on a `<select>`, so a `value` binding writes the state when the user picks an option but does not show the current one on a server-rendered page. Write the choice with an [action](/language/actions) instead, as in `data-herb-set="sort=$value"`, and mark the rendered option with `selected` when the state can start at something other than the first option.

::: code-group
```erb [app/views/newsletters/_signup.html.erb]
<%# herb:slots client %>
<%# herb:state (draft: "", subscribed: false) %>

<input value="<%= draft %>">
<input type="checkbox" checked="<%= subscribed %>">
<button disabled="<%= draft == "" %>">Send</button>
```
:::

**Template Ruby may not assign a state.** The client never sees a write made on the server.

```
app/views/messages/_composer.html.erb:4:1: `attempts = 5` assigns the state `attempts`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered.
```

### Counting folds

The one assignment allowed is a count. An increment behind a state condition inside a keyed loop declares a total that the client keeps current as the rows change.

::: code-group
```erb [app/views/tasks/index.html.erb]
<%# herb:slots client %>
<%# herb:state (done_count: 0) %>
<ul>
  <% @tasks.each do |task| %>
    <%# herb:key task.id %>
    <%# herb:state (done: false) %>
    <% if done %><% done_count += 1 %><% end %>
    <li><input type="checkbox" checked="<%= done %>"> <%= task.title %></li>
  <% end %>
</ul>
<p><%= done_count %> done</p>
```
:::

The total is an Integer state declared at the top of the template. It is counted exactly once, and read only after the loop, where the count is complete.

## Compile errors

These stop a template from rendering.

| Cause | Message begins |
| --- | --- |
| A Float, Array or Hash default | ``The state `rate` has a Float default.`` |
| A name that is also a strict local | ``` `open` is both a strict local and a state.``` |
| A derived default that mixes in other Ruby | ``The state `busy` defaults to `pending \|\| current_user.admin?`, which mixes state reads with other Ruby.`` |
| Template Ruby that assigns a state | ``` `attempts = 5` assigns the state `attempts`.``` |
| A `state:` name the partial does not declare | ``` `shared/album_card` declares no state `opened`.``` |
| A `state:` value of another kind | ``` `open` on `shared/album_card` is a boolean state, and `"yes"` seeds it with a string value.``` |

## Related rules

- [`herb-state-requires-slots`](/linter/rules/herb-state-requires-slots)
- [`herb-state-directive-syntax`](/linter/rules/herb-state-directive-syntax)
- [`herb-state-single-declaration`](/linter/rules/herb-state-single-declaration)
- [`herb-state-valid-declaration`](/linter/rules/herb-state-valid-declaration)
- [`herb-state-valid-reads`](/linter/rules/herb-state-valid-reads)
- [`herb-state-valid-bindings`](/linter/rules/herb-state-valid-bindings)
- [`herb-state-no-server-writes`](/linter/rules/herb-state-no-server-writes)
- [`herb-state-no-silent-reads`](/linter/rules/herb-state-no-silent-reads)
- [`herb-state-no-shadowed-states`](/linter/rules/herb-state-no-shadowed-states)
- [`herb-state-no-unused-states`](/linter/rules/herb-state-no-unused-states)
