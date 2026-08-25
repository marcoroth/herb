# Linter Rule: One `herb:state` declaration per scope

**Rule:** `herb-state-single-declaration`

## Description

Requires each scope to declare all of its states in a single `herb:state` directive.

## Rationale

The engine merges several directives in one scope without complaint, so splitting a scope's states across directives changes nothing about how the template runs. What it changes is how the template reads. The declaration is the one place that enumerates a scope's states with their defaults, and a reader who finds one directive reasonably stops looking. A second directive further down quietly widens the scope's state set behind their back. The signature syntax holds any number of states, so there is no cost to keeping them together.

A directive inside a collection body declares item states and is its own scope, so a region directive and an item directive never conflict with each other.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (open: false, draft: "") %>

<input value="<%= draft %>">
<% if open? %><nav>Menu</nav><% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (open: false) %>

<% @rows.each do |row| %>
  <%# herb:state (selected: false) %>
  <input type="checkbox" checked="<%= selected %>">
<% end %>

<% if open? %><nav>Menu</nav><% end %>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (open: false) %>
<%# herb:state (draft: "") %>

<input value="<%= draft %>">
<% if open? %><nav>Menu</nav><% end %>
```

## References

\-
