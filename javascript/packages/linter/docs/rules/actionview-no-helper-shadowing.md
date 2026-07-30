# Linter Rule: Disallow shadowing Action View helpers with local variables

**Rule:** `actionview-no-helper-shadowing`

## Description

Disallow introducing a local variable named after an Action View helper, such as `tag`, `content_tag`, `link_to`, `label`, `select`, or `time_ago_in_words`.

This applies no matter how the local variable is created:

- block arguments — `@tags.each do |tag|`
- `render` block arguments — `render @tags do |tag|`
- `for` loop variables — `for tag in @tags`
- assignments — `tag = @tags.first`, `first, tag = @tags`, `link_to ||= default`
- strict locals — `<%# locals: (tag:) %>`

## Severity

Offenses are reported at one of two severities depending on the helper:

- Helpers that Herb rewrites through its `action_view_helpers` transform (`tag`, `content_tag`, `link_to`, `image_tag`, `javascript_tag`, `javascript_include_tag`, and `turbo_frame_tag`) are reported at the rule's configured severity (`error` by default). Shadowing these does not just read confusingly, it can change how the template is parsed.
- Every other public Action View helper is reported as a `hint`, since shadowing them is a readability concern rather than a parsing one.

## Rationale

Rails exposes helpers like the `tag` builder (`tag.div`, `tag.br`) directly in templates. When a local variable reuses one of those names, for example `@tags.each do |tag|`, the helper is no longer reachable by its bare name inside that scope, and an expression like `tag.name` reads exactly like a call to the `tag` builder even though it actually refers to the local variable.

Renaming the variable (for example to `tag_item`) keeps the helper unambiguous and the template easy to read.

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
