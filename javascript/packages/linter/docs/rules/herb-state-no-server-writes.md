# Linter Rule: Disallow server-side writes to declared states

**Rule:** `herb-state-no-server-writes`

## Description

Disallows assigning a declared state in template Ruby, with one exception. A counting fold, an increment like `pending_count += 1` behind a state condition inside a keyed loop, declares an aggregate the client keeps current, so it is allowed and validated instead. A valid fold counts into an Integer region state, exactly once, and the count is read only after the loop.

## Rationale

A declared state compiles to a plain Ruby local on the server, so an assignment like `<% pending = true %>` runs fine at render and then diverges. The server rendered one value, the client owns another, and the first client write snaps the page to a state the author never saw. The engine rejects the same assignments at compile time. This rule reports them in the editor first, and points at the paths that do work. A seed carries an initial value, a derived state computes from other states, a counting fold aggregates over items, and `data-herb-set` or `state.set` write at runtime.

The fold is the one blessed assignment because the client can re-run it. Counting items whose condition holds needs no Ruby evaluator, so the count stays current when an item's state flips or a row is added or removed.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (pending_count: 0) %>

<ul>
  <% @messages.each do |message| %>
    <%# herb:state (pending: false) %>
    <% if pending? %><% pending_count = pending_count + 1 %><% end %>
    <li id="<%= message.id %>"><%= message.body %></li>
  <% end %>
</ul>

<p><%= pending_count %> sending</p>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, total: 0) %>

<% pending = true %>

<ul>
  <% @messages.each do |message| %>
    <% if message.big? %><% total += 1 %><% end %>
    <li id="<%= message.id %>"><%= message.body %></li>
  <% end %>
</ul>

<p><%= pending %> · <%= total %></p>
```

## Limits

The engine restricts a fold's condition to pure state reads, since the client re-evaluates it per item. An increment behind a server condition like `message.big?` cannot be recounted client-side, so it draws the plain assignment offense; the fix it suggests includes restructuring the condition into an item state.

## References

\-
