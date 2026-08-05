# Linter Rule: Do not call `render` without rendering the result

**Rule:** `actionview-no-silent-render`

## Description

Require that all `render` calls in ERB appear inside output tags (`<%= ... %>`), not control tags (`<% ... %>`). Otherwise, the call is evaluated but its result is silently discarded.

## Rationale

Rails' `render` method returns HTML-safe strings meant to be included in the final response. If it's placed inside a non-output ERB tag (`<% render(...) %>`), the result is silently ignored. This is almost always a mistake and leads to confusion.

This rule catches these silent rendering issues and enforces that `render` is only used when its result is actually rendered.

## Examples

### ✅ Good

```erb
<%= render "shared/error" %>
```

```erb
<%= render partial: "comment", collection: @comments %>
```

```erb
<%= render @product %>
```

Escaped ERB tags (`<%%` and `<%%=`) are ignored. They render as the literal text `<%`/`<%=` rather than being executed, so generator and scaffold templates that emit `render` calls into the file they generate are not flagged:

```erb
<%% cache [menu, @page] do %>
  <ul class="nav">
    <%%= render partial: menu.to_partial_path, collection: menu.children %>
  </ul>
<%% end %>
```

### 🚫 Bad

```erb
<% render "shared/error" %>
```

```erb
<% render partial: "comment", collection: @comments %>
```

```erb
<% render @product %>
```

## References

\-
