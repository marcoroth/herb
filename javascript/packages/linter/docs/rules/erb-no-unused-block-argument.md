# Linter Rule: Disallow unused block arguments in ERB iteration blocks

**Rule:** `erb-no-unused-block-argument`

## Description

Disallow declaring a block argument on an ERB iteration block when it is never referenced in the block body.

```erb
<% @users.each do |user| %>
  <p>Hello</p>
<% end %>
```

```
Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.
```

## Rationale

An unused block argument is usually one of two things: a leftover from an edit that removed the code using it, or a sign that the wrong variable is being referenced in the body. Both are worth a second look.

It is also a readability signal. `<% @users.each do |user| %>` tells a reader the body renders something about each user. When nothing in the body uses `user`, the declaration is misleading, and `<% @users.each do %>` or `<% @users.count.times do %>` says what is actually happening.

Ruby's convention for a binding that is deliberately ignored is a leading underscore, so `_user` is treated as intentional and never reported.

Only the Ruby inside ERB tags and interpolation is searched, never the surrounding HTML, so markup that happens to contain the same word does not count as a use:

```erb
<% @users.each do |user| %>
  <div class="user">A user</div>
<% end %>
```

The above is still reported, because nothing in Ruby refers to `user`. Matching is on whole identifiers, so `users_count` does not count as a use of `user` either.

Only positional and splat arguments are reported. An unused `&block` or `**options` reads differently and is left alone.

## Examples

### ✅ Good

```erb
<% @users.each do |user| %>
  <%= user.name %>
<% end %>
```

```erb
<% @users.each do |user| %>
  <%= link_to "Profile", user_path(user) %>
<% end %>
```

```erb
<% @users.each do |user| %>
  <% if user.admin? %>
    <p>admin</p>
  <% end %>
<% end %>
```

```erb
<% @users.each do |_user| %>
  <p>Hello</p>
<% end %>
```

```erb
<% 3.times do %>
  <p>Hello</p>
<% end %>
```

### 🚫 Bad

```erb
<% @users.each do |user| %>
  <p>Hello</p>
<% end %>
```

```erb
<% @pairs.each do |key, value| %>
  <%= key %>
<% end %>
```

```erb
<% @groups.each do |group| %>
  <% @users.each do |user| %>
    <%= user.name %>
  <% end %>
<% end %>
```

## References

- [Ruby Style Guide: Underscore Unused Vars](https://rubystyle.guide/#underscore-unused-vars)
