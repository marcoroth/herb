# Linter Rule: Disallow strict locals that are never used in the partial

**Rule:** `actionview-no-unused-strict-locals`

## Description

Detects locals declared in a `<%# locals: (...) %>` declaration that the partial never references.

## Rationale

A strict locals declaration is the contract of a partial. Every name in it tells the caller "this partial needs this value", and Rails raises `ActionView::StrictLocalsError` when a caller passes anything that is not declared. A name the template never reads makes that contract lie: callers keep computing and passing a value that is thrown away, and readers have to search the whole template before they can be sure it is unused.

Unused locals usually appear when a partial is refactored. The markup that used the value moves elsewhere or disappears, and the declaration stays behind. Removing the name keeps the contract honest and tells everyone calling the partial that they can stop passing it.

Because dropping a local from the declaration makes Rails raise for callers that still pass it, this rule is not autocorrectable. Update the call sites in the same change.

Locals prefixed with an underscore are skipped, which is the way to keep a name in the contract on purpose, for example while a partial is being migrated.

The rule also stops reporting for a template that reads `local_assigns` as a whole, such as `<%= render "row", **local_assigns %>`, since every local can reach the output through it. Reading a single local from it, like `local_assigns[:user]` or `local_assigns.fetch(:user)`, still counts as a normal usage.

## Examples

### ✅ Good

```erb
<%# locals: (name:) %>

<%= name %>
```

```erb
<%# locals: (name:, greeting: "Hello") %>

<%= greeting %>, <%= name %>!
```

### 🚫 Bad

```erb
<%# locals: (name:, age:) %>

<%= name %>
```

```erb
<%# locals: (user:, size:) %>

<div class="card">
  <%= user.name %>
</div>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
- [Rails API - `ActionView::Template`](https://api.rubyonrails.org/classes/ActionView/Template.html)
