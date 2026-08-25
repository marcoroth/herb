# Linter Rule: Disallow return statements in ERB templates

**Rule:** `erb-no-return`

## Description

Disallow `return` statements inside ERB templates. Templates should not use `return` to control rendering flow; use a conditional in the template or move the guard to the controller or component instead.

## Rationale

Using `return` in an ERB template can silently abort rendering of the surrounding view, particularly when it appears in a partial. This makes rendering flow harder to reason about and can produce subtle bugs. Templates are declarative views, so rendering decisions should use conditionals or live outside the template.

## Examples

### ✅ Good

```erb
<% if condition? %>
  <p>Content</p>
<% end %>
```

### 🚫 Bad

```erb
<% return "" unless condition? %>

<p>Content</p>
```
