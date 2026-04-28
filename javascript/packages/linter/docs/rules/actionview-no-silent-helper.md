# Linter Rule: Disallow silent ERB tags for Action View helpers

**Rule:** `actionview-no-silent-helper`

## Description

Action View helpers like `link_to`, `form_with`, and `content_tag` must use output ERB tags (`<%= %>`) so their rendered HTML is included in the page. Using silent ERB tags (`<% %>`) discards the helper's output entirely.

## Rationale

Action View helpers generate HTML that needs to be rendered into the template. When a helper is called with a silent ERB tag (`<% %>`), the return value is evaluated but silently discarded, meaning the generated HTML never appears in the output. This is almost always a mistake and can lead to confusing bugs where elements are missing from the page with no obvious cause. Using `<%= %>` ensures the helper's output is properly rendered.

## Examples

### ✅ Good

```erb
<%= link_to "Home", root_path %>
```

```erb
<%= form_with model: @user do |f| %>
  <%= f.text_field :name %>
<% end %>
```

```erb
<%= button_to "Delete", user_path(@user), method: :delete %>
```

```erb
<%= content_tag :div, "Hello", class: "greeting" %>
```

### 🚫 Bad

```erb
<% link_to "Home", root_path %>
```

```erb
<% form_with model: @user do |f| %>
  <%= f.text_field :name %>
<% end %>
```

```erb
<% button_to "Delete", user_path(@user), method: :delete %>
```

```erb
<% content_tag :div, "Hello", class: "greeting" %>
```

## References

* [Rails Action View Helpers documentation](https://api.rubyonrails.org/classes/ActionView/Helpers.html)
