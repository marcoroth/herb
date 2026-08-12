# Linter Rule: Disallow empty ERB control flow blocks

**Rule:** `erb-no-empty-control-flow`

## Description

Disallow empty ERB control flow blocks such as `if`, `elsif`, `else`, `unless`, `for`, `while`, `until`, `when`, `in`, `begin`, `rescue`, `ensure`, and `do` blocks.

Empty control flow blocks add unnecessary noise to templates and are often the result of incomplete refactoring, copy/paste errors, or forgotten placeholder code.

## Rationale

An empty control flow block serves no purpose and makes templates harder to read. It often indicates code that was accidentally deleted, an incomplete refactoring where the logic was removed but the structure was left behind, or a placeholder that was never filled in.

This rule helps keep templates clean and intentional. Offenses are reported as hints with the `unnecessary` diagnostic tag, so editors like VS Code will render the empty blocks with faded text.

## Examples

### ✅ Good

```erb
<% if condition %>
  <p>Content</p>
<% end %>
```

```erb
<% case status %>
<% when "active" %>
  <p>Active</p>
<% when "inactive" %>
  <p>Inactive</p>
<% end %>
```

```erb
<% items.each do |item| %>
  <p><%= item.name %></p>
<% end %>
```

### 🚫 Bad

```erb
<% if condition %>
<% end %>
```

```erb
<% if condition %>
  <p>Content</p>
<% else %>
<% end %>
```

```erb
<% case value %>
<% when "a" %>
<% when "b" %>
  <p>B</p>
<% end %>
```

```erb
<% unless condition %>
<% end %>
```

```erb
<% items.each do |item| %>
<% end %>
```

```erb
<% begin %>
  <p>Try this</p>
<% rescue %>
<% end %>
```

## References

\-
