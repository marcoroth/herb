# Linter Rule: Require `data-herb-into` to name a keyed collection

**Rule:** `herb-into-requires-collection`

## Description

Requires the `data-herb-into` attribute on a form to be a static value naming a keyed collection in the same template, an element carrying `data-herb-name` around a loop whose rows are keyed by a `herb:key` directive or a dynamic `id`.

## Rationale

A form with `data-herb-into` is an optimistic send: the runtime intercepts the submit and inserts a row into the named collection before the server answers. The name resolves within the form's own region, so it has to exist in this template, and it has to be a keyed collection, since an optimistic row needs a key to be confirmed under. A name that resolves to nothing, to a value slot, or to an unkeyed loop sends nothing at runtime and reports `herb-unknown-collection` in debug mode. This rule says the same thing in the editor, before the page runs.

## Examples

### ✅ Good

```erb
<ul data-herb-name="messages">
  <% @messages.each do |message| %>
    <%# herb:key message.id %>
    <li><%= message.body %></li>
  <% end %>
</ul>

<form action="/messages" method="post" data-herb-into="messages">
  <input name="body" autocomplete="off">
  <button>Send</button>
</form>
```

### 🚫 Bad

```erb
<ul data-herb-name="messages">
  <% @messages.each do |message| %>
    <%# herb:key message.id %>
    <li><%= message.body %></li>
  <% end %>
</ul>

<form action="/messages" method="post" data-herb-into="posts">
  <input name="body" autocomplete="off">
  <button>Send</button>
</form>
```

```erb
<p data-herb-name="summary"><%= @summary %></p>

<form action="/messages" method="post" data-herb-into="summary">
  <input name="body" autocomplete="off">
  <button>Send</button>
</form>
```

## References

\-
