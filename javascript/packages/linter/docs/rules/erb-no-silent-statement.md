# Linter Rule: Disallow silent ERB statements

**Rule:** `erb-no-silent-statement`

## Description

Disallow silent ERB tags (`<% %>`) that execute statements whose return value is discarded. Logic like method calls should live in controllers, helpers, or presenters, not in views. Assignments are allowed since they are pragmatic for DRYing up templates.

## Rationale

Silent ERB tags that aren't control flow or assignments are a code smell. They execute Ruby code whose return value is silently discarded, which usually means the logic belongs in a controller, helper, or presenter rather than the view.

## Examples

### ✅ Good

```erb
<%= title %>
<%= render "partial" %>
```

```erb
<% x = 1 %>
<% @title = "Hello" %>
<% x ||= default_value %>
<% x += 1 %>
```

```erb
<% if user.admin? %>
  Admin tools
<% end %>
```

```erb
<% users.each do |user| %>
  <p><%= user.name %></p>
<% end %>
```

### 🚫 Bad

```erb
<% some_method %>
```

```erb
<% helper_call(arg) %>
```

## References

\-
