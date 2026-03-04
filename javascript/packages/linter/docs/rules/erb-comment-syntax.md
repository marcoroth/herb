# Linter Rule: Disallow Ruby comments immediately after ERB tags

**Rule:** `erb-comment-syntax`

## Description

Disallow ERB tags that start with `<% #` (with a space before the `#`). Use the ERB comment syntax `<%#` instead.

## Rationale

Ruby comments starting immediately after an ERB tag opening (e.g., `<% # comment %>`) can cause parsing issues in some contexts. The proper ERB comment syntax `<%# comment %>` is more reliable and explicitly designed for comments in templates.

For multi-line comments or actual Ruby code with comments, ensure the content starts on a new line after the opening tag.

## Examples

### ✅ Good

```erb
<%# This is a proper ERB comment %>

<%
  # This is a proper ERB comment
%>

<%
  # Multi-line Ruby comment
  # spanning multiple lines
%>
```

### 🚫 Bad

```erb
<% # This should be an ERB comment %>

<%= # This should also be an ERB comment %>

<%== # This should also be an ERB comment %>
```

## References

- [Inspiration: ERB Lint `CommentSyntax` rule](https://github.com/shopify/erb_lint?tab=readme-ov-file#commentsyntax)
