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

## Autofix

This rule supports **unsafe autofix** via `--fix-unsafely`. It inserts a declaration at the top of the file, inferred from two sources: the locals every `render` call site passes to the partial, and the locals the partial's own body reads.

```erb
<%# locals: (footer: nil, title: nil, **) %>
```

Every inferred local is optional, and `**` is added whenever the set of callers cannot be trusted to be complete. Both follow from how Action View behaves.

A declaration binds only the locals it names. `<%# locals: (**) %>` accepts any local but binds none of them, so a body reading `title` raises `NameError` even when the caller passed it. Naming the locals is the point; `**` only covers locals a caller passes that the body never reads.

Locals are optional rather than required because a required local raises when a caller omits it, and the caller set is never guaranteed complete. Renders from controllers and mailers live in Ruby files the linter does not read, computed partial names cannot be resolved, and files excluded from linting are not scanned. `**` is added whenever any of those apply, or when the partial reads `local_assigns`.

Locals read by the body but passed by no visible caller are still named, since that is the only way to recover a local passed from a caller Herb cannot see. Herb cannot always tell such a local from an application-defined helper, because both parse the same way inside a template, so review what the fix produces.

This is considered "unsafe" because:
- It changes the partial's behavior (strict mode will now error on undeclared locals)
- The inferred signature is only as complete as the call sites Herb can see

To apply the autofix:

```bash
herb-lint --fix-unsafely _partial.html.erb
```

After the autofix runs, review the declaration, tighten locals from `nil` defaults to required where every caller passes them, and remove `**` once you are confident the list is complete.

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
