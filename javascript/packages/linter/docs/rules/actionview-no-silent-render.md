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
