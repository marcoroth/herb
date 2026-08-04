# Linter Rule: Prefer a stable key on collection rows

**Rule:** `reactivity-prefer-collection-key`

## Description

Require every row of a collection to carry an identity that survives the collection changing, either as a `herb-key` or `id` attribute on the row's element, or as a `<%# herb:key ... %>` directive when the row has no single element to put one on.


## Rationale

When a collection re-renders, rows have to be matched against the ones already in the document. Without an identity to match on, the only thing left is position, so inserting a row at the top makes every row below it look like it changed. Those rows are rebuilt rather than moved, and anything the browser was holding for them is thrown away: focus, text selection, scroll position, the value of a partially typed input, media playback, and the internal state of any custom element.

A key makes that a move instead of a rebuild. It is also what lets a reorder be sent as a reorder rather than as a full replacement of the list.

Any stable, per-row value works. Rails templates already carry one in most cases, because `dom_id` is used for Turbo Stream targets, so adding `id` usually costs nothing and is worth preferring over a bespoke attribute.

The key has to identify the *row*, not its position. An `id` built from the loop index changes meaning as soon as anything is inserted, which reintroduces exactly the problem the key was meant to solve.

Every loop the parser recognises as an iteration is flagged, except the ones that count rather than walk a collection (`times`, `upto`, `downto`, `step`). Their items are positions, so a key could only ever restate the index.

A row does not have to be a single element. When the body has several roots, or none at all, there is nothing to hang an attribute on, and the directive names the key for the whole row instead.

Wrapping the row in one element and keying that is equally valid, but it is offered second because it is not always available: a row of `<dt>` and `<dd>` inside a `<dl>`, a `<tr>` inside a table, or an `<li>` inside a list cannot take a wrapper without breaking the markup around it. The directive adds nothing to the output, so it works everywhere.

## Examples

### ✅ Good

```erb
<% @users.each do |user| %>
  <li id="<%= dom_id(user) %>"><%= user.name %></li>
<% end %>
```

```erb
<% @users.each do |user| %>
  <li herb-key="<%= user.id %>"><%= user.name %></li>
<% end %>
```

A row that is not a single element names its key with the directive:

```erb
<% @users.each do |user| %>
  <%# herb:key user.id %>

  <dt><%= user.name %></dt>
  <dd><%= user.email %></dd>
<% end %>
```

Counting loops are not flagged, since their items are positions:

```erb
<% 3.times do |index| %>
  <li><%= index %></li>
<% end %>
```

### 🚫 Bad

```erb
<% @users.each do |user| %>
  <li><%= user.name %></li>
<% end %>
```

```erb
<% @users.map do |user| %>
  <div><%= user.name %></div>
<% end %>
```

```erb
<% @users.each do |user| %>
  <dt><%= user.name %></dt>
  <dd><%= user.email %></dd>
<% end %>
```

## References

- [React: Rendering Lists, keeping list items in order with `key`](https://react.dev/learn/rendering-lists)
- [Lit: the `repeat` directive](https://lit.dev/docs/templates/directives/#repeat)
