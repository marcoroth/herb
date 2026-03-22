# Linter Rule: Require strict locals on the first line with a blank line after

**Rule:** `erb-strict-locals-first-line`

## Description

Requires that the strict locals declaration:

1. Appears on the **first line** of a Rails partial template
2. Is followed by a **blank line** before any content

A partial is any template whose filename begins with an underscore (e.g. `_card.html.erb`).

## Rationale

While Rails accepts strict locals declarations anywhere in a partial, placing them at the very top, followed by a blank line, makes the partial's expected locals immediately visible and visually separated from the template body. This mirrors conventions like `# frozen_string_literal: true` in Ruby files.

Enforcing this placement ensures that locals are the first thing you see when opening the file, that the partial's public API is clearly separated from its content, and consistent across all partials in the codebase.

## Examples

### ✅ Good

```erb [app/views/users/_card.html.erb]
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

### 🚫 Bad

Strict locals not on the first line:

```erb [app/views/users/_card.html.erb]
<div class="user-card">
  <%# locals: (user:) %>
  <%= user.name %>
</div>
```

Strict locals after a leading blank line:

```erb [app/views/users/_card.html.erb]

<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

Strict locals on line 1 but no blank line before content:

```erb [app/views/users/_card.html.erb]
<%# locals: (user:) %>
<div class="user-card">
  <%= user.name %>
</div>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
