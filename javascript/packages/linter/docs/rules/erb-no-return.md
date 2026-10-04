# Linter Rule: Disallow return statements in ERB templates

**Rule:** `erb-no-return`

## Description

Disallow `return` statements that end the render of an ERB template. Templates should not use `return` to control rendering flow; use a conditional in the template or move the guard to the controller or component instead.

A `return` inside a lambda, a `def` or a `define_method` block only exits that lambda or method, so it doesn't end the render and is allowed. A `return` inside a plain block, a loop or a `proc` returns from the template itself and is still reported. Inside a block or loop, use `next` to skip the rest of the block or `break` to stop iterating.

## Rationale

Using `return` in an ERB template can silently abort rendering of the surrounding view, particularly when it appears in a partial. This makes rendering flow harder to reason about and can produce subtle bugs. Templates are declarative views, so rendering decisions should use conditionals or live outside the template.

## Examples

### ✅ Good

```erb
<% if condition? %>
  <p>Content</p>
<% end %>
```

```erb
<% format_time = ->(time) {
     return "TBA" unless time

     time.strftime("%H:%M")
   } %>

<p><%= format_time.call(talk.starts_at) %></p>
```

```erb
<% items.each do |item| %>
  <% next if item.hidden? %>

  <li><%= item.name %></li>
<% end %>
```

### 🚫 Bad

```erb
<% return "" unless condition? %>

<p>Content</p>
```

```erb
<% items.each do |item| %>
  <% return if item.hidden? %>

  <li><%= item.name %></li>
<% end %>
```
