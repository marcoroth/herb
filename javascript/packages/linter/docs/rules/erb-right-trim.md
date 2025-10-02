# Linter Rule: Enforce consistent right-trimming syntax

**Rule:** `erb-right-trim`

## Description

This rule enforces the use of `-%>` for right-trimming ERB output tags (like `<%= %>`) instead of `=%>`. It also warns when right-trimming syntax (`-%>` or `=%>`) is used on non-output ERB tags (like `<% %>`, `<% if %>`, etc.) where it has no effect.

## Rationale

While `=%>` can be used for right-trimming whitespace in some ERB engines (like Erubi), it is an obscure and not well-defined syntax that lacks consistent support across most ERB implementations. The `-%>` syntax is the standard, well-documented approach for right-trimming that is universally supported and consistent with left-trimming syntax (`<%-`).

Additionally, right-trimming syntax only has an effect on ERB output tags (`<%=` and `<%==`). Using `-%>` or `=%>` on non-output ERB tags (control flow like `<% if %>`, `<% each %>`, etc.) has no effect and is misleading.

Using `-%>` for output tags ensures compatibility across different ERB engines, improves code clarity, and aligns with established Rails and ERB conventions.

## Examples

### ✅ Good

```erb
<%= title -%>

<% if true %>
  <h1>Content</h1>
<% end %>

<% items.each do |item| %>
  <li><%= item -%></li>
<% end %>
```

### 🚫 Bad

```erb
<%= title =%>


<% title =%>


<% title -%>


<% if true -%>
  <h1>Content</h1>
<% end %>


<% items.each do |item| =%>
  <li><%= item %></li>
<% end %>
```

## References

- [Inspiration: ERB Lint `RightTrim` rule](https://github.com/Shopify/erb_lint/blob/main/README.md#righttrim)
