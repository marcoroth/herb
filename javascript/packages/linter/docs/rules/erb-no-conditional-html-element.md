# Linter Rule: Disallow conditional HTML elements

**Rule:** `erb-no-conditional-html-element`

## Description

Disallow the pattern of opening an HTML tag in one conditional block and closing it in another conditional block with the same condition. This creates a "conditional element" where the element's existence depends on a runtime condition.

## Rationale

This pattern is difficult to read, maintain, and reason about. It can lead to confusion when trying to understand the document structure, and it makes the template harder to format, lint, and analyze. The opening and closing tags are visually separated, making it non-obvious that they form a matched pair.

Instead, prefer using `capture` blocks with `content_tag` helpers, which make the conditional wrapping explicit and keeps the logic together.

## Examples

### ✅ Good

Using a `capture` block to conditionally wrap content:

```erb
<% content = capture do %>
  <div>Content</div>
<% end %>

<% if wrap_in_dialog? %>
  <dialog><%= content %></dialog>
<% else %>
  <%= content %>
<% end %>
```

```erb
<% content = capture do %>
  <div>Content</div>
<% end %>

<%= wrap_in_dialog? ? content_tag(:dialog, content) : content %>
```

Complete elements within conditional branches:

```erb
<% if some_condition %>
  <div class="a">Content</div>
<% else %>
  <div class="b">Content</div>
<% end %>
```

### 🚫 Bad

Opening and closing tags in separate conditional blocks:

```erb
<% if wrap_in_dialog? %>
  <dialog>
<% end %>

<div>Stuff</div>

<% if wrap_in_dialog? %>
  </dialog>
<% end %>
```

```erb
<% if @with_icon %>
  <div class="icon">
<% end %>
  <span>Hello</span>
<% if @with_icon %>
  </div>
<% end %>
```

```erb
<% if @with_icon %>
  <div class="icon">
<% else %>
  <div class="no-icon">
<% end %>

  <span>Hello</span>
</div>
```

## References

\-
