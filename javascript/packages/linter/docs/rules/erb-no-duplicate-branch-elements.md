# Linter Rule: Disallow duplicate elements across conditional branches

**Rule:** `erb-no-duplicate-branch-elements`

## Description

Disallow the same HTML elements wrapping content in every branch of an ERB conditional (`if/elsif/else`, `unless/else`, `case/when/else`). When all branches share identical wrapper elements, those elements should be hoisted outside the conditional. Only flags when all branches are covered (i.e., an `else` clause is present).

## Rationale

Duplicated wrapper elements across all branches of a conditional are unnecessary repetition. Moving them outside the conditional reduces template size, makes the structure clearer, and avoids the risk of branches getting out of sync when one is updated but others are forgotten.

## Examples

### ✅ Good

Elements hoisted outside the conditional:

```erb
<div class="wrapper">
  <% if condition %>
    Hello World
  <% else %>
    Goodbye World
  <% end %>
</div>
```

Branches with different elements:

```erb
<% if condition %>
  <div>Hello World</div>
<% else %>
  <span>World</span>
<% end %>
```

Same tag name but different attributes:

```erb
<% if condition %>
  <div class="a">Hello World</div>
<% else %>
  <div class="b">World</div>
<% end %>
```

Incomplete branch coverage:

```erb
<% if condition %>
  <div>Hello World</div>
<% end %>
```

### 🚫 Bad

```erb
<% if condition %>
  <div>Hello World</div>
<% else %>
  <div>Goodbye World</div>
<% end %>
```

```erb
<% if condition %>
  <div>Hello World</div>
<% elsif other %>
  <div>Goodbye World</div>
<% else %>
  <div>Default</div>
<% end %>
```

```erb
<% case value %>
<% when "a" %>
  <div>Hello World</div>
<% when "b" %>
  <div>Goodbye World</div>
<% else %>
  <div>Default</div>
<% end %>
```

```erb
<% if condition %>
  <div><p>Hello World</p></div>
<% else %>
  <div><p>Goodbye World</p></div>
<% end %>
```

## References

\-
