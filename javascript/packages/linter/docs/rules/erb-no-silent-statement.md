# Linter Rule: Disallow silent ERB statements

**Rule:** `erb-no-silent-statement`

## Description

Disallow silent ERB tags (`<% %>`) that execute statements whose return value is discarded. Logic like method calls should live in controllers, helpers, or presenters, not in views. Assignments are allowed since they are pragmatic for DRYing up templates.

Control-flow keywords (`next`, `break`, `redo`, `return`, `raise`, and their `if`/`unless` modifier forms) are allowed since they have no return value to discard and cannot be moved out of the template. View-to-layout helpers (`content_for`, `provide`, and other designated side-effect helpers) are also allowed, matching [`erb-no-unused-expressions`](./erb-no-unused-expressions.md).

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

```erb
<% users.each do |user| %>
  <% next if user.hidden? %>
  <% break if reached_limit? %>
  <p><%= user.name %></p>
<% end %>
```

```erb
<% content_for(:title, "Dashboard") %>
<% provide(:sidebar, render("sidebar")) %>
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
