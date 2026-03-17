# Linter Rule: Disallow passing both content and block to tag helpers

**Rule:** `actionview-no-content-and-block`

## Description

Disallow passing both a positional content argument and a block to tag helpers like `tag.div` or `content_tag`. When both are provided, the block content takes precedence and the argument is silently ignored.

## Rationale

In Rails, when a block is passed to a tag helper, it overrides any content argument. Developers may assume the content argument will appear or be combined with the block content, but it is silently discarded. This can lead to unexpected behavior and confusion.

## Examples

### ✅ Good

```erb
<%= tag.div "Hello" %>

<%= tag.div do %>
  Hello
<% end %>

<%= tag.div class: "container" do %>
  Hello
<% end %>

<%= content_tag :section, "Welcome" %>

<%= content_tag :section do %>
  Welcome
<% end %>
```

### 🚫 Bad

```erb
<%= tag.div "Hello" do %>
  World
<% end %>

<%= content_tag :section, "Intro" do %>
  Welcome
<% end %>
```

## References

- [Rails `content_tag` docs](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)
- [Rails `tag` API](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
