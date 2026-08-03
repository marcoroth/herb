# Linter Rule: Prefer `do ... end` over `{ ... }` for blocks that span multiple ERB tags

**Rule:** `erb-prefer-do-end-blocks`

## Description

Disallow `{ ... }` as the delimiters of a block that is opened in one ERB tag and closed in another.

```erb
<% @users.each { |user| %>
  <p><%= user.name %></p>
<% } %>
```

## Rationale

A block that spans ERB tags is a multi-line block, and `do ... end` is the convention for those in Ruby. In a template the argument is stronger than in plain Ruby: every other construct that wraps markup, like `if`, `unless`, `case`, or `each` with `do`, closes with `<% end %>`, so a lone `<% } %>` is the one closing tag that has to be read differently from the rest of the file.

The braces are also easy to lose. `<% } %>` is a single character of signal surrounded by ERB punctuation, and it looks the same whether it closes a block, a hash, or an interpolation, whereas `<% end %>` says what it does.

A brace block written entirely inside a single ERB tag is not reported. `<%= @users.map { |user| user.name }.join(", ") %>` stays on one line and reads fine, which is also what RuboCop's [`Style/BlockDelimiters`](https://docs.rubocop.org/rubocop/cops_style.html#styleblockdelimiters) prefers for single-line blocks.

## Autofix

This rule provides an autofix that replaces `{` with `do` and the matching `<% } %>` with `<% end %>`:

```erb
<%= form_with(model: @user) { |form| %>
  <%= form.submit %>
<% } %>
```

```erb
<%= form_with(model: @user) do |form| %>
  <%= form.submit %>
<% end %>
```

`{` binds to the closest method call while `do` binds to the outermost one, so the fix is only safe when both are the same call. When they aren't, as in `<% puts @users.map { |user| %>` where the block belongs to `map` but a `do` would hand it to `puts`, the offense is still reported but the fix requires `--fix-unsafely`.

## Examples

### ✅ Good

```erb
<% @users.each do |user| %>
  <p><%= user.name %></p>
<% end %>
```

```erb
<%= form_with(model: @user) do |form| %>
  <%= form.submit %>
<% end %>
```

```erb
<%= @users.map { |user| user.name }.join(", ") %>
```

### 🚫 Bad

```erb
<% @users.each { |user| %>
  <p><%= user.name %></p>
<% } %>
```

```erb
<%= form_with(model: @user) { |form| %>
  <%= form.submit %>
<% } %>
```

```erb
<% @users.each { %>
  <p>Hello</p>
<% } %>
```

## References

- [RuboCop: `Style/BlockDelimiters`](https://docs.rubocop.org/rubocop/cops_style.html#styleblockdelimiters)
- [Ruby Style Guide: `{...}` vs `do...end`](https://rubystyle.guide/#single-line-blocks)
