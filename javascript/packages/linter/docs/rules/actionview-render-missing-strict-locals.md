# Linter Rule: Require `render` calls to pass every required strict local

**Rule:** `actionview-render-missing-strict-locals`

## Description

Detects `render` calls that do not pass a local the target partial declares as required in its `<%# locals: (...) %>` declaration.

## Rationale

A strict locals declaration is a contract, and Rails enforces it at render time: a partial declaring `<%# locals: (user:) %>` raises `ActionView::StrictLocalsError` the moment it is rendered without `user:`. Because the failure only happens when that branch of the template actually runs, a broken `render` call can sit in a rarely visited view for a long time before anyone sees it.

This is the one rule in the linter that reads a second file. It resolves the partial name the same way Action View does, reads the declaration out of the resolved partial, and compares it against the locals the `render` call passes.

Locals with a default value are never reported, since Rails supplies the default when the caller leaves them out. A `**` keyword rest in the declaration does not change anything either: it lets a caller pass *extra* locals, but the declared required ones are still required.

## Requirements

The rule needs an index of the project's partials, which the CLI builds from the project root. It stays silent when it has no index, so it does not report on a single source string, in the playground, or anywhere the surrounding project is unknown.

It also only reports what it can prove. These are all skipped:

| Skipped | Why |
| --- | --- |
| `render partial_name` | The name is only known at runtime |
| `render "users/#{kind}"` | Same, the name is interpolated |
| `render "users/card", **locals` | The splat can carry any local |
| `render partial: "users/card", locals: some_hash` | The hash is not a literal |
| `render partial: "users/card", collection: @users` | Collection renders pass the local implicitly |
| `render partial: "users/card", object: @user` | Object renders pass the local implicitly |
| A partial name that does not resolve to a file | Nothing to compare against |
| A partial with no strict locals declaration | There is no contract to check |

## Examples

Given `app/views/users/_card.html.erb`:

```erb
<%# locals: (user:, size: "large") %>

<div class="card">
  <%= user.name %> (<%= size %>)
</div>
```

### ✅ Good

```erb
<%= render "users/card", user: @user %>
```

```erb
<%= render partial: "users/card", locals: { user: @user, size: "small" } %>
```

### 🚫 Bad

```erb
<%= render "users/card" %>
```

```erb
<%= render partial: "users/card", locals: { size: "small" } %>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
- [Rails API - `ActionView::StrictLocalsError`](https://api.rubyonrails.org/classes/ActionView/StrictLocalsError.html)
