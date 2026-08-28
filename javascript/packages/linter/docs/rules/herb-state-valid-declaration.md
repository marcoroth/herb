# Linter Rule: Validate `herb:state` declarations

**Rule:** `herb-state-valid-declaration`

## Description

Validates `<%# herb:state (name: default, ...) %>` directives. The signature must declare keyword parameters with defaults, each default must be a primitive the client can hold (`true`/`false`, an Integer, a String, a Symbol, or `nil`), a bare-identifier default must name a declared strict local, and a state name must be unique. It may not collide with a strict local, repeat within its scope, or appear in both an item and its region.

A default may also read other states declared before it in the same signature (`busy: pending || failed`), which makes the state derived. The client re-evaluates it whenever a source changes. A derived default may not mix state reads with other Ruby, read a state declared after it, or read a state from an enclosing scope.

## Rationale

A state is client-owned, so both sides have to agree on its value. The default carries the type the client validates operations against, which is why it is required and why it has to be a primitive with one text form both Ruby and JavaScript agree on. Floats print differently in the two languages, an Array on the page is a collection of items, and a Hash is a grouping each leaf can express as its own state.

A derived state works because its default is the same condition grammar the client already resolves for branches, so declaring `busy: pending || failed` names the condition once and every read of `busy` stays current. An expression that mixes a state with server Ruby has no client answer, and one that reads forward has no server value yet, since declarations compile in signature order.

The naming restrictions keep every read unambiguous. A local comes from the caller and a state is client-owned, so one name cannot mean both, and a name declared in an item and its region would make a later read depend on where it sits.

The engine raises these as compile errors when the template renders. This rule reports the same findings in the editor, before a render ever runs.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, attempts: 0, sort: "name") %>

<button data-herb-toggle="pending">Send</button>
<button data-herb-increment="attempts">Retry</button>
<button data-herb-set="sort=date">By date</button>
```

```erb
<%# locals: (open_initially: false) %>
<%# herb:slots client %>
<%# herb:state (open: open_initially) %>

<button data-herb-toggle="open">Menu</button>
<% if open? %><nav>Menu</nav><% end %>
```

```erb
<%# herb:slots client %>
<ul>
  <% @messages.each do |message| %>
    <%# herb:state (pending: false) %>
    <li><%= message.body %> <% if pending? %>Sending<% end %></li>
  <% end %>
</ul>
```

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, failed: false, busy: pending || failed) %>

<div><% if busy %>Working<% else %>Ready<% end %></div>
<input disabled="<%= busy %>">
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (pending:) %>

<% if pending %>Sending<% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (rate: 1.0) %>

<p><%= rate %></p>
```

```erb
<%# herb:slots client %>
<%# herb:state (selected: []) %>

<% if selected %>Selected<% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (draft: { title: "" }) %>

<p><%= draft %></p>
```

```erb
<%# herb:slots client %>
<%# herb:state (open: open_initially) %>

<% if open? %>Open<% end %>
```

```erb
<%# locals: (open: false) %>
<%# herb:slots client %>
<%# herb:state (open: false) %>

<% if open %>Open<% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, busy: pending || current_user.admin?) %>

<div><% if busy %>Working<% end %></div>
```

## References

\-
