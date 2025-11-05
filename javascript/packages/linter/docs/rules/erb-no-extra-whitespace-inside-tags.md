# Linter Rule: Avoid extra whitespace inside ERB tags

**Rule:** `erb-no-extra-whitespace-inside-tags`

## Description

This rule disallows **multiple consecutive spaces** immediately inside ERB tags (`<%`, `<%=`) or before the closing delimiter (`%>`). It ensures that ERB code is consistently and cleanly formatted, with exactly one space after the opening tag and one space before the closing tag (when appropriate).

## Rationale

Excess whitespace inside ERB tags can lead to inconsistent formatting and untidy templates. By enforcing a consistent amount of whitespace inside ERB tags, this rule improves code readability, aligns with the formatter and style guide expectations, and avoids unnecessary visual noise.

## Examples

### ✅ Good

```erb
<%= output %>

<% if condition %>
  True
<% end %>
```

### 🚫 Bad

```erb
<%=  output %>

<%= output  %>

<%  if condition  %>
  True
<% end %>
```

## References

\-
