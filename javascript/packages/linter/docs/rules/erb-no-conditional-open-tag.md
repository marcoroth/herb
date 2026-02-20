# Linter Rule: Disallow conditional open tags

**Rule:** `erb-no-conditional-open-tag`

## Description

Disallow the pattern of using ERB conditionals to vary only the open tag of an element (typically to conditionally change attributes) while sharing the same tag name, body content, and close tag.

## Rationale

This pattern can be difficult to read and maintain. The conditional logic is split from the element's body and closing tag, making it harder to understand the full structure at a glance.

Prefer using:

- `content_tag` with conditional attributes
- A ternary or conditional for the class/attribute value directly
- Separate complete elements in each branch if the differences are significant

## Examples

### ✅ Good

Using conditional attributes directly:

```erb
<div class="<%= @condition ? 'a' : 'b' %>">
  Content
</div>
```

Using `content_tag` with conditional options:

```erb
<%= content_tag :div, class: (@condition ? 'a' : 'b') do %>
  Content
<% end %>
```

Using `class_names` helper:

```erb
<div class="<%= class_names('base', 'a': @condition, 'b': !@condition) %>">
  Content
</div>
```

Complete separate elements when differences are significant:

```erb
<% if @condition %>
  <div class="a" data-foo="bar">Content</div>
<% else %>
  <div class="b" data-baz="qux">Content</div>
<% end %>
```

Self-closing/void elements in conditionals (each branch is complete):

```erb
<% if @large %>
  <img src="photo.jpg" width="800" height="600">
<% else %>
  <img src="photo.jpg" width="400" height="300">
<% end %>
```

### 🚫 Bad

Conditional open tags with shared body and close tag:

```erb
<% if @condition %>
  <div class="a">
<% else %>
  <div class="b">
<% end %>
  Content
</div>
```

```erb
<% if @with_icon %>
  <button class="btn btn-icon" aria-label="Action">
<% else %>
  <button class="btn">
<% end %>
  Click me
</button>
```

Open tag in conditional without else branch:

```erb
<% if @wrap %>
  <div class="wrapper">
<% end %>
  Content
</div>
```

Missing open tag in else branch:

```erb
<% if @style == "a" %>
  <div class="a">
<% elsif @style == "b" %>
  <div class="b">
<% else %>
<% end %>
  Content
</div>
```

Missing open tag in elsif branch:

```erb
<% if @style == "a" %>
  <div class="a">
<% elsif @style == "b" %>
  <%# no-open-tag %>
<% else %>
  <div class="c">
<% end %>
  Content
</div>
```

## References

\-
