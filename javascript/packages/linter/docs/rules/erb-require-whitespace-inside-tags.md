# Linter Rule: Enforce whitespace around ERB tag contents

**Rule:** `erb-require-whitespace-inside-tags`

## Description

Require a single space before and after Ruby code inside ERB tags (`<% ... %>` and `<%= ... %>`). This improves readability and keeps ERB code visually consistent with Ruby style guides.

## Rationale

Without spacing, ERB tags can become hard to read and visually cramped:

* difficult to scan: `<%=user.name%>`
* harder to read: `<%if admin%><%end%>`

By enforcing consistent spacing around Ruby expressions, templates become easier to read, review, and maintain. It also aligns with standard Ruby formatting conventions, where spaces are used around control keywords and operators.

## Examples

### ✅ Good

```erb
<%= user.name %>

<% if admin %>
  Hello, admin.
<% end %>
```

### 🚫 Bad

```erb
<%=user.name %>

<%if admin %>

  Hello, admin.
<% end%>
```

## References

\-
