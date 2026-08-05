# Linter Rule: Prefer `each` over `map` when the result is discarded

**Rule:** `erb-prefer-each-over-map`

## Description

Disallow `map` and the other collection-building methods in a silent ERB block, where the collection they return goes nowhere.

```erb
<% @users.map do |user| %>
  <p><%= user.name %></p>
<% end %>
```

```
`map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.
```

## Rationale

`map`, `select` and friends exist to return a new collection. In a silent tag that return value is thrown away, so the method allocates an array for nothing and the code misleads anyone reading it into looking for where the result is used.

When the block renders markup, as it almost always does in a template, `each` is what was meant. When the intent really was to build and print a collection, the tag should be an output tag.

The rule covers `map`, `flat_map`, `select`, `filter`, `reject` and `filter_map`. `each`, `each_with_index`, `times` and the other iteration methods return their receiver and are not reported.

Output tags are left to [`erb-no-output-control-flow`](./erb-no-output-control-flow.md), which reports `<%= @users.map do |user| %>` for a different reason: iteration methods return the collection rather than the rendered markup, so the collection is printed on top of the block's output.

A result that is assigned is not discarded, and is not reported:

```erb
<% names = @users.map do |user| %>
  <%= user.name %>
<% end %>
```

## Examples

### ✅ Good

```erb
<% @users.each do |user| %>
  <p><%= user.name %></p>
<% end %>
```

```erb
<%= @users.map(&:name).join(", ") %>
```

```erb
<% names = @users.map do |user| %>
  <%= user.name %>
<% end %>
```

### 🚫 Bad

```erb
<% @users.map do |user| %>
  <p><%= user.name %></p>
<% end %>
```

```erb
<% @users.select do |user| %>
  <p><%= user.name %></p>
<% end %>
```

```erb
<% @groups.flat_map do |group| %>
  <p><%= group.name %></p>
<% end %>
```

## References

- [Ruby Style Guide: Each vs Map](https://rubystyle.guide/#functional-code)
