# Linter Rule: Disallow shadowing Action View helpers with local variables

**Rule:** `actionview-no-helper-shadowing`

## Description

Disallow introducing a local variable named after an Action View helper that Herb transforms, such as `tag`, `content_tag`, `link_to`, `image_tag`, `javascript_tag`, `javascript_include_tag`, or `turbo_frame_tag`.

This applies no matter how the local variable is created:

- block arguments — `@tags.each do |tag|`
- `render` block arguments — `render @tags do |tag|`
- `for` loop variables — `for tag in @tags`
- assignments — `tag = @tags.first`, `first, tag = @tags`, `link_to ||= default`
- strict locals — `<%# locals: (tag:) %>`

## Rationale

Rails exposes helpers like the `tag` builder (`tag.div`, `tag.br`) directly in templates. When a local variable reuses one of those names — for example `@tags.each do |tag|` — an expression like `tag.name` inside that scope reads exactly like a call to the `tag` builder, even though it actually refers to the local variable.

Calling a method that happens to be named after a helper on some object (for example `record.link_to`) is **not** reported: that is a regular method call, not a local variable that shadows the helper.

## Examples

### Good

```erb
<% @tags.each do |tag_item| %>
  <%= tag_item.name %>
<% end %>
```

```erb
<% @tags.each do |t| %>
  <%= t.name %>
<% end %>
```

```erb
<%= tag.div do %>
  Content
<% end %>
```

```erb
<%= record.link_to %>
```

### Bad

```erb
<% @tags.each do |tag| %>
  <%= tag.name %>
<% end %>
```

```erb
<% for tag in @tags %>
  <%= tag.name %>
<% end %>
```

```erb
<% tag = @tags.first %>
<%= tag.name %>
```

```erb
<%# locals: (tag:) %>
<%= tag.name %>
```

## References

* [Rails `ActionView::Helpers::TagHelper#tag`](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
