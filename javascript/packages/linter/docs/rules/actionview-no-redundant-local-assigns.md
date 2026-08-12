# Linter Rule: Disallow `local_assigns` reads that the strict locals declaration already answers

**Rule:** `actionview-no-redundant-local-assigns`

## Description

Detects `local_assigns` lookups in a partial that already has a `<%# locals: (...) %>` declaration, where the declaration makes the lookup either redundant or dead.

## Rationale

`local_assigns` is the documented way to read locals in a partial that has no strict locals declaration, and it stays useful in a partial that has one. Once a declaration exists, though, some of those lookups are answered by the declaration itself and only obscure what the template does.

A required local is already a local variable, so reading it back out of the hash is a longer way to write the name. A required local is also always present, so asking `local_assigns.key?` about it is a condition that can only take one branch. And a name the declaration does not mention can never arrive, because Rails raises `ActionView::StrictLocalsError` for callers that pass an undeclared local, so a lookup for it is dead code.

Optional locals are left alone. `local_assigns.key?(:size)` is the only way to tell "not passed" apart from "passed as `nil`", which a default value cannot express, so that check is a legitimate pattern rather than an offense. Partials with a `**` keyword rest in the declaration are skipped as well, since undeclared locals can legitimately arrive there.

Partials without a strict locals declaration are not checked at all.

## Examples

### ✅ Good

```erb
<%# locals: (user:) %>

<%= user.name %>
```

```erb
<%# locals: (user:, size: nil) %>

<%= user.name %>
<% if local_assigns.key?(:size) %>
  <span><%= size %></span>
<% end %>
```

```erb
<%# locals: (user:, **) %>

<%= render "row", **local_assigns %>
```

### 🚫 Bad

```erb
<%# locals: (user:) %>

<%= local_assigns[:user].name %>
```

```erb
<%# locals: (user:) %>

<% if local_assigns.key?(:user) %>
  <%= user.name %>
<% end %>
```

```erb
<%# locals: (user:) %>

<%= user.name %>
<%= local_assigns.fetch(:size, "large") %>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
- [Action View - Using `local_assigns`](https://guides.rubyonrails.org/action_view_overview.html#using-local-assigns)
