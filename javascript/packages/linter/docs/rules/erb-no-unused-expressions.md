# Linter Rule: Disallow unused expressions in silent ERB tags

**Rule:** `erb-no-unused-expressions`

## Description

Disallow expressions inside silent ERB tags (`<% %>`) whose return values are discarded. Writing expressions like `<% @user.name %>` or `<% helper_method(arg) %>` evaluates the expression but discards the result, making the line functionally useless.

This rule detects and warns about silent ERB tags containing:

- Method calls without blocks
- Instance variable reads (`@user`)
- Class variable reads (`@@count`)
- Global variable reads (`$global`)
- Constant reads (`CONSTANT`, `Foo::Bar`)

## Rationale

These expressions are evaluated but unused, they don't produce output (not `<%= ... %>`), and they don't perform meaningful side effects (no assignments, no blocks, no control flow). They're likely a mistake where the developer meant to use an output tag (`<%= ... %>`) instead, or they're leftover from refactoring.

## Examples

### ✅ Good

```erb
<%= @user.name %>
```

```erb
<%= helper_method(arg) %>
```

```erb
<% @name = @user.name %>
```

```erb
<% if logged_in? %>
  <p>Welcome!</p>
<% end %>
```

```erb
<% @users.each do |user| %>
  <%= user.name %>
<% end %>
```

### 🚫 Bad

```erb
<% @user.name %>
```

```erb
<% helper_method(arg) %>
```

```erb
<% foo.bar.baz %>
```

```erb
<% @user %>
```

```erb
<% CONSTANT %>
```

```erb
<% User.count %>
```
