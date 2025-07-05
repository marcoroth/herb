# Linter Rule: Disallow empty ERB tags

**Rule:** `erb-no-empty-tags`

## Description

Disallow ERB tags (`<% %>` or `<%= %>`) that contain no meaningful content i.e., tags that are completely empty or contain only whitespace.

## Rationale

Empty ERB tags serve no purpose and may confuse readers or indicate incomplete code. They clutter the template and may have been left behind accidentally after editing.

## Examples

### ✅ Good

```html
<%= user.name %>

<% if user.admin? %>
  Admin tools
<% end %>
```

### 🚫 Bad

```erb
<% %>

<%=  %>

<%
%>
```

## References

\-
