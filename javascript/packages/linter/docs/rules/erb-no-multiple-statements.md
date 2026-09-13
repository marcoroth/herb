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

## Autofix

This rule provides an autofix that gives each statement its own ERB tag. A tag that stands alone on its line is split across lines, keeping its indentation:

```erb
<% user = User.find(1); post = user.posts.first %>
```

```erb
<% user = User.find(1) %>
<% post = user.posts.first %>
```

A tag that shares its line with markup is split in place, since a newline there would land in the rendered output:

```erb
<div><% a = 1; b = 2 %><%= a + b %></div>
```

```erb
<div><% a = 1 %><% b = 2 %><%= a + b %></div>
```

An output tag produces the value of its last statement, so the fix keeps `<%=` on that statement and makes the ones before it silent. `<%- a = 1; b = 2 -%>` trims on both ends, so the leading trim stays on the first statement and the trailing trim on the last.

Splitting a standalone line changes the whitespace the template emits under an engine that does not drop a line holding a single silent tag, which is why the fix is offered as unsafe inside `pre`, `textarea`, `script`, `style` and `xmp`, where that whitespace is visible. A tag that defines a method, a class or a module is not fixed at all, since it belongs outside the template rather than in a tidier tag, and neither is a tag whose statements are followed by a comment, which the fix has no place to put.

## References

- [Ruby Style Guide - Semicolons](https://rubystyle.guide/#no-semicolon)
