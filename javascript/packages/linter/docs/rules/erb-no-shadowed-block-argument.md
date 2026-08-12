# Linter Rule: Disallow block arguments that shadow an enclosing binding

**Rule:** `erb-no-shadowed-block-argument`

## Description

Disallow a block argument or `for` loop index that reuses a name already bound by an enclosing block or `for` loop.

```erb
<% @groups.each do |item| %>
  <% @items.each do |item| %>
    <%= item %>
  <% end %>
<% end %>
```

```
Block argument `item` shadows an outer `item`. Rename it so both remain reachable.
```

## Rationale

Once an inner block reuses a name, the outer binding is unreachable for the rest of that block. Anything in the inner body that meant to refer to the outer value silently gets the inner one instead, and the template still renders, just with the wrong data.

It also makes a template hard to read. In a nested loop, `<%= item %>` gives no indication of which `item` is in play without tracing the nesting by eye.

The offense is reported on the inner argument, since that is the one to rename.

## Examples

### ✅ Good

```erb
<% @groups.each do |group| %>
  <% group.items.each do |item| %>
    <%= item %>
  <% end %>
<% end %>
```

```erb
<% @groups.each do |item| %>
  <%= item %>
<% end %>

<% @items.each do |item| %>
  <%= item %>
<% end %>
```

### 🚫 Bad

```erb
<% @groups.each do |item| %>
  <% @items.each do |item| %>
    <%= item %>
  <% end %>
<% end %>
```

```erb
<% for item in @groups %>
  <% @items.each do |item| %>
    <%= item %>
  <% end %>
<% end %>
```

```erb
<% @a.each do |item| %>
  <% @b.each do |other| %>
    <% @c.each do |item| %>
      <%= item %>
    <% end %>
  <% end %>
<% end %>
```

## References

- [Ruby Style Guide: Shadowing Outer Local Variables](https://rubystyle.guide/#no-shadowing)
- [`actionview-no-helper-shadowing`](./actionview-no-helper-shadowing.md)
