# Linter Rule: Disallow partial paths that are built at runtime

**Rule:** `actionview-no-dynamic-partial-path`

## Description

Detects `render` calls whose partial path is interpolated, concatenated, or computed, so the partial being rendered is not known until the template runs.

## Rationale

A literal path says which file it renders:

```erb
<%= render partial: "users/card" %>
```

A computed one does not:

```erb
<%= render partial: to_grid_partial_path(content) %>
```

Nothing about the second call is wrong, and Rails resolves it happily. What it costs is everything that works by reading the template rather than running it.

Herb keeps an index of the partials in a project, and a literal name is what links a `render` to an entry in it. Given that link the language server can jump from the call to the partial and back to every caller, rename a strict local across all of those call sites at once, complete the locals a partial declares as you type them, and report a call that passes a local the partial does not declare or omits one it requires. A computed name has no entry to point at, so each of those stops at the call.

That trade is worth making in some projects and not in others. A CMS that renders a partial chosen by an editor, or a view that dispatches on a record's type, needs a computed path, and can turn the rule off. It reports at `info` because a computed path is a deliberate choice rather than a mistake.

Branching between literal paths keeps the set of possible partials knowable, so it is not reported:

```erb
<%= render partial: current_user.admin? ? "admin/header" : "user/header" %>
```

Renders that pass an object rather than a name, such as `render @products`, are not reported here. See [`actionview-no-implicit-partial`](./actionview-no-implicit-partial.md).

Only output tags are reported. A `render` in a silent `<% %>` tag discards its output and is covered by [`actionview-no-silent-render`](./actionview-no-silent-render.md).

## Examples

### ✅ Good

```erb
<%= render partial: "users/card" %>
```

```erb
<%= render "users/card", user: @user %>
```

```erb
<%= render partial: current_user.admin? ? "admin/header" : "user/header" %>
```

### 🚫 Bad

```erb
<%= render partial: "users/#{user.role}" %>
```

```erb
<%= render "components/#{name}" %>
```

```erb
<%= render partial: partial_name %>
```

## Configuration

Disable it in `.herb.yml` when computed partial paths are deliberate:

```yaml
linter:
  rules:
    actionview-no-dynamic-partial-path:
      enabled: false
```

## References

- [Action View - Rendering partials](https://guides.rubyonrails.org/layouts_and_rendering.html#using-partials)
