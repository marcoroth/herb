# Linter Rule: Allow one `herb:slots` directive per template

**Rule:** `herb-slots-single-directive`

## Description

Flags every `herb:slots` directive after the first one in a template.

## Rationale

The engine reads only the first `herb:slots` directive in a template, so any later one does nothing, silently. The dangerous shape is a template that already opts into one mode near the top gaining a second directive with the other mode further down, where the author believes they switched modes and the engine never noticed. The offense names the directive that wins and its line, so the fix is one deletion.

The mode tokens themselves are validated by [`herb-slots-valid-mode`](./herb-slots-valid-mode.md), the way `herb:state` splits the same concerns between [`herb-state-directive-syntax`](./herb-state-directive-syntax.md) and [`herb-state-single-declaration`](./herb-state-single-declaration.md).

## Examples

### ✅ Good

```erb
<%# herb:slots client %>

<div><%= @title %></div>
```

### 🚫 Bad

```erb
<%# herb:slots client %>

<div><%= @title %></div>

<%# herb:slots server %>
```

## References

- [`herb-slots-valid-mode`](./herb-slots-valid-mode.md)
- [`herb-state-single-declaration`](./herb-state-single-declaration.md)
