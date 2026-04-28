# Linter Rule: Only allow strict local definitions in partial files

**Rule:** `actionview-strict-locals-partial-only`

## Description

Detects strict locals declarations in files that are not Rails partials. Strict locals are only supported in partials (templates whose filename begins with an underscore), so a declaration in any other template has no effect.

## Rationale

A `<%# locals: (...) %>` comment in a non-partial file (such as a view or layout) is misleading. It looks like it constrains the available local variables, but Rails only processes strict locals in partials. Flagging these declarations prevents confusion and keeps templates honest about their actual contract.

## Examples

### ✅ Good

```erb [app/views/users/_card.html.erb]
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

### 🚫 Bad

```erb [app/views/users/show.html.erb]
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
