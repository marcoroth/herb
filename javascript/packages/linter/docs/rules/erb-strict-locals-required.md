# Linter Rule: Require strict locals in Rails partials

**Rule:** `erb-strict-locals-required`

**Default:** Disabled (opt-in)

## Description

Requires that every Rails partial template includes a strict locals declaration comment using the supported syntax:

```erb
<%# locals: () %>
```

A partial is any template whose filename begins with an underscore (e.g. `_card.html.erb`).

## Rationale

Partials often rely on implicit locals, which makes them harder to understand, refactor, and lint. Requiring strict locals:

- Documents the partial's public API at the top of the file
- Improves readability and onboarding
- Enables better static analysis (unknown locals, missing locals, unused locals)
- Reduces runtime surprises when locals are renamed or removed

This rule encourages partials to be explicit about what they expect. Partials that intentionally accept no locals should still declare an explicit empty signature.

## Configuration

This rule is disabled by default. To enable it, add to your [`.herb.yml`](/configuration):

```yaml [.herb.yml]
linter:
  rules:
    erb-strict-locals-required:
      enabled: true
```

## Examples

### ✅ Good

Partial with required keyword argument:

```erb
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

Partial with keyword argument and default:

```erb [app/views/users/_card.html.erb]
<%# locals: (user:, admin: false) %>

<div class="user-card">
  <%= user.name %>

  <% if admin %>
    <span class="badge">Admin</span>
  <% end %>
</div>
```

Partial with no locals (empty declaration):

```erb [app/views/pages/_content.html.erb]
<%# locals: () %>

<p>Static content only</p>
```

### 🚫 Bad

Partial without strict locals declaration:

```erb [app/views/users/_card.html.erb]
<div class="user-card">
  <%= user.name %>
</div>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
