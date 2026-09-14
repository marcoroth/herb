# Linter Rule: Only allow strict local definitions in partial files

**Rule:** `actionview-strict-locals-partial-only`

**Default:** Disabled (opt-in)

## Description

Detects strict locals declarations in templates that are not Rails partials. A partial is any template whose filename begins with an underscore, such as `_card.html.erb`.

## Rationale

Action View applies strict locals to every template, so a declaration in a view or a layout is honored. The question this rule answers is whether such a template should take locals at all.

A controller renders its view with no locals, so a required local is only reachable when every action rendering that template passes `locals:` explicitly. Instance variables assigned in the action are the usual way to hand data to a view, and they keep working alongside a declaration, since strict locals only constrain the locals hash.

Layouts have a second reason to avoid locals. Action View passes one locals hash to both the layout and the template it wraps, so a layout that accepts no locals raises `ActionView::StrictLocalsError` as soon as any template using it is rendered with locals. A layout that needs to tolerate them declares `<%# locals: (**) %>`.

## Examples

### ✅ Good

```erb [app/views/users/_card.html.erb]
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

```erb [app/views/users/show.html.erb]
<div class="user-card">
  <%= @user.name %>
</div>
```

### 🚫 Bad

```erb [app/views/users/show.html.erb]
<%# locals: (user:) %>

<div class="user-card">
  <%= user.name %>
</div>
```

## Configuration

Strict locals is an Action View feature, so this rule only applies to Action View projects and needs `framework` to be set:

```yaml
framework: actionview
```

This rule is disabled by default. To enable it, add to your [`.herb.yml`](/configuration):

```yaml [.herb.yml]
linter:
  rules:
    actionview-strict-locals-partial-only:
      enabled: true
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
