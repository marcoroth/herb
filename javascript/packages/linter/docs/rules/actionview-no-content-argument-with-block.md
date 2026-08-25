# Linter Rule: Disallow passing a content argument to a helper that is given a block

**Rule:** `actionview-no-content-argument-with-block`

## Description

Detects Action View helpers that are given both a positional content argument and a block, such as `tag.div "Hello" do`, `content_tag :section, "Intro" do` or `link_to "Go", root_path do`.

## Rationale

An Action View helper that takes its content from either an argument or a block only reads one of them. When a block is given, the block wins and the argument goes somewhere the caller did not intend.

For `tag`, `content_tag`, `button_tag`, `label_tag`, `mail_to`, `phone_to` and `sms_to` the argument is silently discarded:

```ruby
content_tag(:section, "Intro") { "Welcome" }
# => "<section>Welcome</section>"
```

Nothing warns, nothing raises, and `"Intro"` never reaches the page. The template reads as if both strings render.

For `link_to` and `button_to` it is worse. Those helpers shift their arguments when a block is given, so the first argument becomes the URL and the second becomes the HTML attributes hash:

```ruby
link_to("Go", "/dashboard") { "Go now" }
# => NoMethodError: undefined method 'stringify_keys' for an instance of String
```

Both helpers are correct with a block as long as the content argument is left out.

The rule reads which argument holds the content, and how many positional arguments survive a block, from the [Action View helper registry](https://github.com/marcoroth/herb/tree/main/config/action_view_helpers), so a helper that gains the same metadata is covered without a change to the rule.

An argument whose value cannot be determined statically is never reported, because Action View treats a hash in that position as the options hash. `content_tag :div, wrapper_options do` may well be passing options and is left alone. Only literal strings, interpolated strings, symbols and numbers are reported.

Helpers whose first argument is not content are unaffected. `field_set_tag "Account" do` renders the legend and the block body, `link_to_if` only calls its block when the condition fails, and `truncate` appends its block to the truncated text.

## Examples

### ✅ Good

```erb
<%= tag.div "Hello" %>
```

```erb
<%= tag.div do %>
  Hello
<% end %>
```

```erb
<%= content_tag :div, class: "card" do %>
  Hello
<% end %>
```

```erb
<%= link_to "Dashboard", root_path %>
```

```erb
<%= link_to root_path do %>
  Dashboard
<% end %>
```

```erb
<%= button_tag class: "primary" do %>
  Save
<% end %>
```

### 🚫 Bad

```erb
<%= tag.div "Hello" do %>
  World
<% end %>
```

```erb
<%= content_tag :section, "Intro" do %>
  Welcome
<% end %>
```

```erb
<%= link_to "Go", root_path do %>
  Go now
<% end %>
```

```erb
<%= button_tag "Save" do %>
  Submit
<% end %>
```

```erb
<%= label_tag :email, "Email" do %>
  Email address
<% end %>
```

## Configuration

This rule only applies to Action View projects, so it needs `framework` to be set:

```yaml
framework: actionview
```

## References

- [Rails API - `ActionView::Helpers::TagHelper#content_tag`](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)
- [Rails API - `ActionView::Helpers::TagHelper#tag`](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
- [Rails API - `ActionView::Helpers::UrlHelper#link_to`](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
