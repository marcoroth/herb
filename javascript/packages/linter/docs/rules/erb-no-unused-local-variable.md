# Linter Rule: Disallow unused local variables in ERB templates

**Rule:** `erb-no-unused-local-variable`

## Description

Disallow assigning a local variable in an ERB template when nothing in the template ever reads it back.

```erb
<% number = posts.count %>

New posts today: -
```

## Rationale

The Ruby in a template is one program, no matter how many ERB tags it is spread across, so a local assigned in one tag is meant to be read in another. When nothing reads it, the assignment either survived an edit that removed the code using it, or the value was supposed to be rendered and never was. The second case is the one worth catching, because the page silently renders without the value rather than failing.

Every tag is checked, so an assignment counts as used when it is read from an attribute value, a conditional branch, a block body, a string interpolation, or a later assignment:

```erb
<% css_class = "card card--wide" %>

<div class="<%= css_class %>">Content</div>
```

The Ruby is what is searched, never the surrounding HTML, so markup or an ERB comment containing the same word is not a use:

```erb
<% number = posts.count %>
<%# number is rendered by the layout %>
```

Scoping follows Ruby's, so a name is only a use of the assignment it actually resolves to. `posts.count` is not a use of a local called `count`, `@number` is not a use of a local called `number`, and a block argument shadowing an outer local reads the argument.

Assignments in an argument list are reported with different advice, because they rarely do what they look like:

```erb
<%= avatar_image(user, size = 40) %>
```

`size = 40` assigns a local and passes `40` positionally. The helper receives the same thing it would have received from a bare `40`, so the name reads like a keyword argument while having no effect on the call. Writing `size: 40` is usually what was meant.

Only plain assignments are reported. A multiple assignment target, a `for` loop variable, a rescued exception and a pattern matching binding are all left alone, since none of them can be removed on its own without changing what the surrounding code binds. Reassignment with `+=`, `||=` or `&&=` reads the variable, so it counts as a use.

Ruby's convention for a binding that is deliberately ignored is a leading underscore, so `_number` is treated as intentional and never reported.

Offenses are tagged as `unnecessary`, so an editor greys out the variable name the way it does for other unused code. The name is greyed rather than the whole assignment, because the value on the right hand side may still be doing work.

The severity is split by mode, reported as `info` in the editor and an `error` on the command line. An unused local is worth cleaning up but is not a reason to interrupt someone mid-edit, so it stays quiet in the editor while still failing a lint run in CI.

## Examples

### ✅ Good

```erb
<% number = posts.count %>

New posts today: <%= number %>!
```

```erb
<% css_class = "card card--wide" %>

<div class="<%= css_class %>">Content</div>
```

```erb
<% title = "Dashboard" %>

<% if signed_in? %>
  <h1><%= title %></h1>
<% end %>
```

```erb
<% total = 0 %>

<% line_items.each do |line_item| %>
  <% total += line_item.amount %>
<% end %>

<%= total %>
```

```erb
<% _number = posts.count %>
```

```erb
<%= avatar_image(user, size: 40) %>
```

### 🚫 Bad

```erb
<% number = posts.count %>

New posts today: -
```

```erb
<% title = "Posts" %>
<% title = "Articles" %>
```

```erb
<% if signed_in? %>
  <% title = "Dashboard" %>
<% end %>

<h1>Welcome</h1>
```

```erb
<% number = posts.count %>

<p>number</p>
```

```erb
<%= avatar_image(user, size = 40) %>
```

## References

- [Ruby Style Guide: Underscore Unused Vars](https://rubystyle.guide/#underscore-unused-vars)

Inspired by [RuboCop's `Lint/UselessAssignment`](https://docs.rubocop.org/rubocop/cops_lint.html#lintuselessassignment).
