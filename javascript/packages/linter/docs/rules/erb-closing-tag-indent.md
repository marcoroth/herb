# Linter Rule: Enforce consistent closing ERB tag indentation

**Rule:** `erb-closing-tag-indent`

## Description

This rule enforces that the closing ERB tag (`%>`) is consistently indented relative to its opening tag (`<%` or `<%=`). When an ERB tag spans multiple lines, the closing `%>` must be on its own line and indented to match the column position of the opening tag.

## Rationale

Inconsistent indentation of closing ERB tags makes templates harder to read and maintain. When an ERB tag spans multiple lines, the closing `%>` should visually align with the opening `<%` to clearly show the tag boundaries. Conversely, if the opening tag is on the same line as the content, the closing tag should also be on the same line.

## Examples

### ✅ Good

```erb
<%= title %>
```

```erb
<% if admin? %>
  <h1>Content</h1>
<% end %>
```

```erb
<%
  some_helper(
    arg1,
    arg2
  )
%>
```

```erb
  <%
    if true
  %>
```

### ❌ Bad

```erb
<% if true
%>
```

```erb
<%
  if true %>
```

```erb
<%
  if true
  %>
```

## References

- [Inspiration: ERB Lint `ClosingErbTagIndent` rule](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/closing_erb_tag_indent.rb)
