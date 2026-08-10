# Linter Rule: Disallow method definitions inside ERB templates

**Rule:** `erb-no-method-definitions`

## Description

Disallow defining Ruby methods inside ERB files using `def ... end` or `define_method`. View templates should only contain logic necessary for rendering the page. Defining methods in ERB mixes concerns and breaks MVC conventions.

## Rationale

Defining methods in a view template:

- Pollutes the view context
- Makes templates harder to read and debug
- Introduces global-like behavior into views
- Encourages non-reusable, non-testable logic
- Violates Rails' separation of concerns

Method definitions belong in helpers, presenters, or view components, not in view files.

## Examples

### ✅ Good

```ruby
# app/helpers/application_helper.rb

module ApplicationHelper
  def format_date(date)
    date.strftime("%B %d")
  end

  def admin?
    current_user.admin?
  end
end
```

### 🚫 Bad

```erb
<% def format_date(date) %>
  <%= date.strftime("%B %d") %>
<% end %>

<p><%= format_date(Date.today) %></p>
```

```erb
<% def admin? = current_user.admin? %>
```

```erb
<% define_method(:admin?) { current_user.admin? } %>
```
