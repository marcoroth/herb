# Linter Rule: Disallow unused block arguments in ERB blocks

**Rule:** `erb-no-unused-block-argument`

## Description

Disallow declaring a block argument on an ERB block when it is never referenced in the block body.

This applies to every block that spans ERB tags, both iteration blocks and helper blocks such as `form_with`.

```erb
<% @users.each do |user| %>
  <p>Hello</p>
<% end %>
```

## Rationale

An unused block argument is usually one of two things: a leftover from an edit that removed the code using it, or a sign that the wrong variable is being referenced in the body. Both are worth a second look.

It is also a readability signal. `<% @users.each do |user| %>` tells a reader the body renders something about each user. When nothing in the body uses `user`, the declaration is misleading, and `<% @users.each do %>` or `<% @users.count.times do %>` says what is actually happening.

For helper blocks the signal is often stronger. A `form_with` block that never touches its builder has no fields in it, which is rarely what was intended:

```erb
<%= form_with model: @user do |form| %>
  <p>Nothing</p>
<% end %>
```

When the only argument of an `each` is unused, the block is not iterating over anything, it is repeating its body once per element. A block runs just as well without declaring the argument at all, so the message spells that out:

```erb
<% pages.each do |page| %>
  <div class="page"></div>
<% end %>
```

That wording is only used for a receiver that reads as a plain reference, like `pages`, `@user.pages` or `Page.all`. When the `each` is called on something that takes arguments or a block, or is called with `&.`, the receiver is not worth repeating in the message, so the regular message is used.

When the unused argument is the index of an `each_with_index`, the message suggests `each` instead, for the same reason:

```erb
<% @pairs.each_with_index do |(name, data), index| %>
  <%= name %>: <%= data %>
<% end %>
```

That suggestion is only made for the plain `|element, index|` shape. With any other parameter list the index is not simply droppable, so the regular message is used.

Ruby's convention for a binding that is deliberately ignored is a leading underscore, so `_user` is treated as intentional and never reported.

Only the Ruby inside ERB tags and interpolation is searched, never the surrounding HTML, so markup that happens to contain the same word does not count as a use:

```erb
<% @users.each do |user| %>
  <div class="user">A user</div>
<% end %>
```

The above is still reported, because nothing in Ruby refers to `user`. Matching is on whole identifiers, so `users_count` does not count as a use of `user` either.

Only positional and splat arguments are reported. An unused `&block` or `**options` reads differently and is left alone.

Offenses are tagged as `unnecessary`, so an editor greys the argument out the way it does for other unused code.

The severity is also split by mode, reported as `info` in the editor and an `error` on the command line:

An unused argument is worth cleaning up but is not a reason to interrupt someone mid-edit, so it stays quiet in the editor while still failing a lint run in CI.

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

```erb
<% pages.each do %>
  <div class="page"></div>
<% end %>
```

```erb
<%= form_with model: @user do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```erb
<% @pairs.each do |(name, data)| %>
  <%= name %>: <%= data %>
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

```erb
<%= form_with model: @user do |form| %>
  <p>Nothing</p>
<% end %>
```

```erb
<% @pairs.each_with_index do |(name, data), index| %>
  <%= name %>: <%= data %>
<% end %>
```

```erb
<% pages.each do |page| %>
  <div class="page"></div>
<% end %>
```

## References

- [Ruby Style Guide: Underscore Unused Vars](https://rubystyle.guide/#underscore-unused-vars)
