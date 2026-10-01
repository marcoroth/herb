# Keys and collections <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

A collection is a loop in a template that compiles with [slots](/language/slots). A key tells the client which row is which, so it can add, remove and reorder rows without touching the others.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<ul>
  <% @messages.each do |message| %>
    <%# herb:key message.id %>
    <li><%= message.body %></li>
  <% end %>
</ul>
```
:::

A row without a key still renders. The engine warns, and inserting or reordering a row re-renders every row after it, which loses focus, scroll position and anything typed into those rows.

## `herb:key`

Names the key for the rows of the loop it sits in.

```erb notwoslash
<%# herb:key expression %>
```

Place it inside the loop body. The expression is Ruby, evaluated once per row, and it should be unique and stable across renders, such as a record id. A keyed row may declare its own [state](/language/state#scope).

## Other ways to key a row

A dynamic `herb-key` or `id` attribute on the row's element keys it too.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<ul>
  <% @messages.each do |message| %>
    <li herb-key="<%= message.id %>"><%= message.body %></li>
  <% end %>
</ul>
```
:::

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<ul>
  <% @messages.each do |message| %>
    <li id="<%= dom_id(message) %>"><%= message.body %></li>
  <% end %>
</ul>
```
:::

`herb-key` stays in the rendered HTML.

## `data-herb-name`

Names a slot so client code and forms can address it. On the element around a loop, it names the collection.

```html notwoslash
<ul data-herb-name="messages">
```

The name is static text, so `data-herb-name="<%= field %>"` is a compile error. It is unique among the named slots in its scope, though the same name may repeat at a different level, such as a `body` inside each row and a `body` outside the loop. The element has to hold something dynamic, and a name on static markup is a compile error as well.

## `data-herb-into`

Adds a row to a named collection the moment a form is submitted, before the server answers.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# herb:slots client %>
<ul data-herb-name="messages">
  <% @messages.each do |message| %>
    <%# herb:key message.id %>
    <li><p data-herb-name="body"><%= message.body %></p></li>
  <% end %>
</ul>

<form action="/messages" method="post" data-herb-into="messages">
  <input name="message[body]" autocomplete="off">
  <button>Send</button>
</form>
```
:::

The value names a keyed collection in the same template. The new row is built from the row markup the template already rendered, and each form field fills the row slot with the same name. A Rails field name is read by its last bracketed part, so `message[body]` fills `body`.

The row carries a temporary key until the server answers, and the answer gives it its real key in place, so the element on screen stays the same. A failed request marks the row as failed and keeps it on the page.

## Rules

A deferred component, `<Async>` or `<Lazy>`, cannot sit inside a collection. A `data-herb-into` that names something other than a keyed collection sends nothing, and both the linter and the client in debug mode report it.

## Related rules

- [`herb-into-requires-collection`](/linter/rules/herb-into-requires-collection)
- [`herb-valid-slot-names`](/linter/rules/herb-valid-slot-names)
