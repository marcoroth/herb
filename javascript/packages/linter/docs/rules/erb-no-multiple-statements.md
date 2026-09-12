# Linter Rule: Disallow multiple Ruby statements in a single-line ERB tag

**Rule:** `erb-no-multiple-statements`

## Description

Disallow multiple Ruby statements separated by semicolons within a single-line ERB tag. Each ERB tag on a single line should contain at most one Ruby statement.

## Rationale

Multiple Ruby statements on a single line in an ERB tag reduce readability and make templates harder to maintain. Splitting statements into separate ERB tags makes each statement easier to understand at a glance.

This rule only applies to single-line ERB tags. Multi-line ERB tags are not checked, as they naturally provide visual separation between statements.

Only the statements the tag itself introduces are counted. A tag holding a single conditional or block is one statement, however many statements its branches or body contain, so `<% if admin?; role = "admin"; else; role = "user"; end %>` is not reported.

## Examples

### ✅ Good

```erb
<% user = User.find(1) %>
<% post = user.posts.first %>
```

```erb
<%= user.name %>
```

```erb
<%
  user = User.find(1)
  post = user.posts.first
%>
```

### 🚫 Bad

```erb
<% user = User.find(1); post = user.posts.first %>
```

```erb
<%= user = User.find(1); user.name %>
```

```erb
<% a = 1; b = 2; c = 3 %>
```

## References

- [Ruby Style Guide - Semicolons](https://rubystyle.guide/#no-semicolon)
