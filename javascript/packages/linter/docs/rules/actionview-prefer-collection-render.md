# Linter Rule: Prefer collection rendering over rendering a partial in a loop

**Rule:** `actionview-prefer-collection-render`

## Description

Prefer `render partial: "...", collection: ...` over calling `render` for a single partial inside an `each` loop.

The reported message contains the exact replacement tag, built from the loop's receiver and the partial being rendered, so it can be pasted over the loop:

```erb
<% @users.each do |user| %>
  <%= render "user", user: user %>
<% end %>
```

```
Prefer `<%= render partial: "user", collection: @users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.
```

Rendering an object directly reports the shorthand collection form instead:

```erb
<% @users.each do |user| %>
  <%= render user %>
<% end %>
```

```
Prefer `<%= render @users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.
```

## Rationale

When a partial is rendered inside a loop, Action View looks the template up and sets up a fresh local scope on every iteration. Collection rendering does that work once and then reuses it for every element, so it is meaningfully faster for anything but the shortest collections.

Collection rendering also passes each element as a local named after the partial, and provides a `<partial>_counter` local, which removes the need to thread the loop variable through by hand.

Because the rewrite emits the partial and nothing else, this rule only fires when the loop body is exactly one output `render` and the only local passed is the block argument. Loops that wrap the partial in markup, pass extra locals, or use a block argument the partial doesn't receive are left alone, since collection rendering cannot express them.

## Examples

### ✅ Good

```erb
<%= render partial: "user", collection: @users %>
```

```erb
<%= render @users %>
```

Loops that do more than render a single partial are not flagged, because collection rendering cannot express them:

```erb
<% @users.each do |user| %>
  <li><%= render "user", user: user %></li>
<% end %>
```

```erb
<% @users.each do |user| %>
  <%= render "user", user: user, admin: true %>
<% end %>
```

```erb
<% @users.each_with_index do |user, index| %>
  <%= render "user", user: user %>
<% end %>
```

### 🚫 Bad

```erb
<% @users.each do |user| %>
  <%= render "user", user: user %>
<% end %>
```

```erb
<% @users.each do |user| %>
  <%= render partial: "user", locals: { user: user } %>
<% end %>
```

```erb
<% @users.each do |user| %>
  <%= render user %>
<% end %>
```

## References

- [Action View Partials: Rendering Collections](https://guides.rubyonrails.org/layouts_and_rendering.html#rendering-collections)
