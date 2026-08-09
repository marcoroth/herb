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

With `framework: actionview` configured, the rule knows what each Action View helper hands to its block, so rather than suggesting the builder be dropped, the message names it and leaves the underscore as the way to say the omission is deliberate.

The reverse is stronger still. `cache`, `content_tag` and `link_to` call their block without any arguments, so an argument declared there is bound to `nil` whatever the block does, as is an argument past the end of what the helper yields, like a second one on a `form_with`:

```erb
<% cache @post do |entry| %>
  <p>Nothing</p>
<% end %>
```

Both of these only apply to a project that sets `framework: actionview` in `.herb.yml`. Anywhere else a `cache` or `form_with` block is whatever the project defines it to be, so the registry says nothing about it and the regular messages are used.

When every argument of a block is unused, the block does not need a parameter list at all, and the message says so with the tag that is already there, minus the `|...|`:

```erb
<% pages.each do |page| %>
  <div class="page"></div>
<% end %>
```

That is not limited to iteration. An unused index suggests `<% 3.times do %>`, an unused row suggests `<% CSV.parse(data).each do %>`. The tag is rewritten from the source, so whatever the block is called on is kept as it is, including trim markers, safe navigation and arguments. The rewrite is skipped when the tag spans multiple lines, when it is long enough to make the message unwieldy, or when an argument the rule does not report would be left behind, and the message falls back to a plain `Remove it`.

Removing one argument out of several is a different edit than removing all of them, because a block destructures what it is yielded based on how many parameters it declares:

```ruby
[[1, 2], [3, 4]].each { |a, b| } # a is 1, b is 2
[[1, 2], [3, 4]].each { |a| }    # a is [1, 2]
```

Dropping `value` from `|key, value|` would silently rebind `key` to the whole pair, so when only some of the arguments are unused, the message offers the underscore and nothing else:

```erb
<% @pairs.each do |key, value| %>
  <%= key %>
<% end %>
```

When the unused argument is the index of an `each_with_index`, the message suggests `each` instead, since that is what the loop is actually doing:

```erb
<% @pairs.each_with_index do |(name, data), index| %>
  <%= name %>: <%= data %>
<% end %>
```

That suggestion is only made for the plain `|element, index|` shape. With any other parameter list the index is not simply droppable, so the regular message is used. When neither argument is used, the rewritten tag drops the `_with_index` as well and suggests `<% @pairs.each do %>`.

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

```erb
<% cache @post do |entry| %>
  <p>Nothing</p>
<% end %>
```

## References

- [Ruby Style Guide: Underscore Unused Vars](https://rubystyle.guide/#underscore-unused-vars)
