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

Strict locals is an Action View feature, so this rule only applies to Action View projects and needs `framework` to be set:

```yaml
framework: actionview
```

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
<%# locals: (footer: nil, title: nil) %>
```

Every inferred local is optional, which follows from how Action View behaves. A required local raises when a caller omits it, and the caller set is never guaranteed complete. Renders from controllers and mailers live in Ruby files the linter does not read, computed partial names cannot be resolved, and files excluded from linting are not scanned.

The fix never adds `**`. A `**` splat accepts any local a caller passes without binding it as a local variable, so a local the declaration missed is swallowed silently and the body raises `NameError` where it reads it. Without `**`, the caller passing an undeclared local fails loudly with `unknown local`, which is how a gap in the inferred list gets noticed. A partial that reads undeclared keys through `local_assigns` needs either those keys declared or `**` added by hand.

Locals read by the body but passed by no visible caller are still named, since that is the only way to recover a local passed from a caller Herb cannot see. Herb cannot always tell such a local from an application-defined helper, because both parse the same way inside a template, so review what the fix produces.

This is considered "unsafe" because:
- It changes the partial's behavior (strict mode will now error on undeclared locals)
- The inferred signature is only as complete as the call sites Herb can see

To apply the autofix:

```bash
herb-lint --fix-unsafely _partial.html.erb
```

After the autofix runs, review the declaration, tighten locals from `nil` defaults to required where every caller passes them, and add any local a caller passes that the body never reads.

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
