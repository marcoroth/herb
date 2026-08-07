# Linter Rule: Prefer explicit `if`/`unless` blocks over inline conditions

**Rule:** `erb-prefer-explicit-conditionals`

## Description

Disallow inline (trailing) `if` and `unless` conditions in ERB output tags. The condition should be an explicit `<% if %>` block around the output tag.

```
Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if done? %><%= icon(:check) %><% end %>` instead.
```

## Rationale

An inline condition hides the branch at the end of the line, after the expression it guards. In a template the interesting question is usually "when is this rendered?", and the explicit form puts that answer first, where every other conditional in the template already has it.

The explicit form also stays readable when the expression or the condition grows, and it is the form the rest of the template already uses: an inline condition is the one conditional that can't gain an `else` branch or a second element without being rewritten first.

Ternaries are not reported. `<%= user.admin? ? admin_badge : user_badge %>` picks between two values rather than conditionally rendering one, and is idiomatic in an output tag.

Silent tags are not reported either. `<% redirect_to root_path if user.nil? %>` is plain Ruby control flow, where the inline form is the conventional style.

## Autofix

This rule provides a safe autofix that replaces the tag with the explicit form the parser already derives for it:

```erb
<%= avatar_for(user) if user.avatar? %>
```

```erb
<% if user.avatar? %><%= avatar_for(user) %><% end %>
```

The fix stays on one line; run the formatter afterwards to break it up.

Two cases are reported but not fixed:

- A trimming tag closing (`<%= value if condition -%>`), because the `-%>` would end up mid-line, where it no longer trims the same whitespace.
- A parenthesized ternary inside the condition (`<%= (a ? b : c) if d %>`), because the rewrite would expand the ternary into an `if`/`else` block as well.

## Examples

### ✅ Good

```erb
<% if done? %>
  <%= icon(:check) %>
<% end %>
```

```erb
<% unless user.admin? %>
  <%= badge %>
<% end %>
```

```erb
<%= user.admin? ? admin_badge : user_badge %>
```

### 🚫 Bad

```erb
<%= link_to "Edit", edit_post_path(post) if post.editable_by?(current_user) %>
```

```erb
<%= badge unless user.admin? %>
```

```erb
<a href="/" <%= 'aria-current=page' if selected %>>About</a>
```

## References

- [Ruby Style Guide: Modifier `if`/`unless`](https://rubystyle.guide/#if-as-a-modifier)
