# Linter Rule: Enforce strict locals comment syntax

**Rule:** `erb-strict-locals-comment-syntax`

## Description

Ensures that strict locals comments use the exact `locals: ( ... )` syntax so they are properly recognized by Rails and tooling.

## Rationale

Strict locals comments declare which locals are expected in a template. Misspellings or malformed syntax silently disable the declaration, leading to confusing runtime errors when required locals are missing. This rule catches invalid comment forms early.

## Examples

### ✅ Good

```erb
<%# locals: (user:, admin: false) %>
<p><%= user.name %></p>

<%# locals: (title:) %>
<h1><%= title %></h1>
```

### 🚫 Bad

```erb
<%# locals() %>
<%# local: (user:) %>
<%# locals (user:) %>
<%# locals: user %>
<%# locals: %>
<%# locals: (user: %>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
